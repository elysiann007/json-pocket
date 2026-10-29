import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
function files(t, a, b) {
  const directory = mkdtempSync(join(tmpdir(), 'json-pocket-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const left = join(directory, 'before.json'), right = join(directory, 'after.json');
  writeFileSync(left, a); writeFileSync(right, b);
  return { directory, left, right };
}
const run = (args, options = {}) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10_000, ...options });

test('CLI exit codes distinguish equal, different and invalid input', t => {
  const { left, right } = files(t, '{"a":1}', '{"a":1.0}');
  assert.equal(run([left, right]).status, 0);
  writeFileSync(right, '{"a":2}');
  assert.equal(run([left, right]).status, 1);
  writeFileSync(right, 'bad JSON');
  const invalid = run([left, right]);
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /Invalid JSON/);
});

test('JSON mode preserves Unicode values while escaping terminal controls', t => {
  const { left, right } = files(t, '{}', JSON.stringify({ message: 'کتاب 📚\u202e' }));
  const result = run([left, right, '--json']);
  assert.equal(result.status, 1, result.stderr);
  assert.equal(JSON.parse(result.stdout).changes[0].after, 'کتاب 📚\u202e');
  assert.doesNotMatch(result.stdout, /\u202e/);
  assert.equal(readFileSync(left, 'utf8'), '{}');
  assert.equal(readFileSync(right, 'utf8'), JSON.stringify({ message: 'کتاب 📚\u202e' }));
});

test('UTF-8 BOM input and bounded JSON output work', t => {
  const { left, right } = files(t, '\uFEFF{"a":1,"b":1}', '{"a":2,"b":2}');
  const result = run([left, right, '--json', '--max-changes', '1']);
  assert.equal(result.status, 1, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.truncated, true);
  assert.equal(value.changes.length, 1);
});

test('malformed options, missing files and oversized files fail without modifying data', t => {
  const { left, right } = files(t, '{}', '{}');
  for (const args of [[left], [left, right, '--json', '--json'], [left, right, '--max-changes', '0'], [left, right, '--max-changes'], [left, right, '--unknown']]) assert.equal(run(args).status, 2);
  assert.equal(run([left, right + '.missing']).status, 2);
  writeFileSync(right, ' '.repeat(4 * 1024 * 1024 + 1));
  const result = run([left, right]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /4 MiB/);
  assert.equal(readFileSync(left, 'utf8'), '{}');
});

test('help and version work from any working directory without data access', () => {
  const help = run(['--help'], { cwd: tmpdir() });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Exit codes/);
  const version = run(['--version'], { cwd: tmpdir() });
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), '0.1.0');
  assert.equal(run(['--version', 'extra']).status, 2);
});

test('invalid UTF-8 is rejected instead of comparing replacement characters', t => {
  const { left, right } = files(t, '"replacement"', JSON.stringify('\uFFFD'));
  writeFileSync(left, Buffer.from([0x22, 0xff, 0x22]));
  const result = run([left, right]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /UTF-8/);
  assert.equal(result.stdout, '');
});
