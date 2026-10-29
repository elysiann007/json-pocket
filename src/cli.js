#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { compareJson } from './diff.js';

const help = [
  'JSON Pocket — offline JSON comparison',
  '',
  'Usage: node src/cli.js <before.json> <after.json> [--json] [--max-changes N]',
  '       node src/cli.js --help',
  '       node src/cli.js --version',
  '',
  'Exit codes: 0 equal, 1 different, 2 invalid input or I/O error.',
  'Files are read locally and never modified. No network calls.',
  'Limits: 4 MiB per file, 128 levels, 100000 nodes per input, 1000 changes.'
].join('\n');

function serialized(value, pretty = false) {
  return JSON.stringify(value, null, pretty ? 2 : undefined)
    .replace(/[\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,
      character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
}

function outputError(error) {
  if (error.code === 'EPIPE') return;
  console.error('Error: ' + serialized(error.message));
  process.exitCode = 2;
}
process.stdout.on('error', outputError);

function readJson(file) {
  const limit = 4 * 1024 * 1024;
  const info = statSync(file);
  if (!info.isFile() || info.size > limit) throw new Error('Each input must be a file no larger than 4 MiB.');
  const bytes = readFileSync(file);
  if (bytes.length > limit) throw new Error('Each input must be no larger than 4 MiB.');
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')); }
  catch { throw new Error('Invalid JSON or UTF-8 in ' + file + '.'); }
}

function main(args) {
  if (!args.length || args[0] === '--help' || args[0] === '-h') {
    if (args.length > 1) throw new Error('--help does not accept extra arguments.');
    console.log(help);
    return;
  }
  if (args[0] === '--version' || args[0] === '-v') {
    if (args.length !== 1) throw new Error('--version does not accept extra arguments.');
    console.log(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8').replace(/^\uFEFF/, '')).version);
    return;
  }
  const paths = [];
  let json = false;
  let maxChanges = 1000;
  const seen = new Set();
  let literalPaths = false;
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (!literalPaths && value === '--') { literalPaths = true; continue; }
    if (!literalPaths && value.startsWith('-')) {
      if (seen.has(value)) throw new Error('Repeated option: ' + value);
      seen.add(value);
      if (value === '--json') { json = true; continue; }
      if (value === '--max-changes') {
        const count = args[++index];
        if (!count || !/^[1-9]\d*$/.test(count) || Number(count) > 1000) throw new Error('--max-changes must be 1..1000.');
        maxChanges = Number(count);
        continue;
      }
      throw new Error('Unknown option: ' + value);
    }
    paths.push(value);
  }
  if (paths.length !== 2) throw new Error('Provide exactly two JSON files. Use --help.');
  const result = compareJson(readJson(paths[0]), readJson(paths[1]), { maxChanges });
  process.exitCode = result.equal ? 0 : 1;
  if (json) process.stdout.write(serialized(result, true) + '\n');
  else if (result.equal) console.log('JSON values are equal.');
  else {
    for (const change of result.changes) {
      console.log(change.kind + ' ' + serialized(change.path) +
        (Object.hasOwn(change, 'before') ? ' before=' + serialized(change.before) : '') +
        (Object.hasOwn(change, 'after') ? ' after=' + serialized(change.after) : ''));
    }
    if (result.truncated) console.log('Output truncated: additional differences exist.');
  }
}

try { main(process.argv.slice(2)); }
catch (error) { outputError(error); }
