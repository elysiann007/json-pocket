import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareJson } from '../src/diff.js';

test('key order, numeric spellings and signed zero do not create differences', () => {
  assert.deepEqual(compareJson({ b: 2, a: -0 }, { a: 0, b: 2.0 }), { equal: true, changes: [], truncated: false });
});

test('reports deterministic nested additions, changes and removals', () => {
  const result = compareJson({ z: true, user: { name: 'Ada', old: null } }, { user: { name: 'Lin', new: 3 } });
  assert.deepEqual(result.changes, [
    { kind: 'changed', path: '/user/name', before: 'Ada', after: 'Lin' },
    { kind: 'added', path: '/user/new', after: 3 },
    { kind: 'removed', path: '/user/old', before: null },
    { kind: 'removed', path: '/z', before: true }
  ]);
});

test('array order matters and additions/removals use numeric pointer tokens', () => {
  assert.deepEqual(compareJson([1, 2], [2, 1, 3]).changes, [
    { kind: 'changed', path: '/0', before: 1, after: 2 },
    { kind: 'changed', path: '/1', before: 2, after: 1 },
    { kind: 'added', path: '/2', after: 3 }
  ]);
  assert.deepEqual(compareJson([1, 2], [1]).changes, [{ kind: 'removed', path: '/1', before: 2 }]);
});

test('root replacement and null are distinct from missing values', () => {
  assert.deepEqual(compareJson(null, {}).changes, [{ kind: 'changed', path: '', before: null, after: {} }]);
  assert.deepEqual(compareJson({}, { x: null }).changes, [{ kind: 'added', path: '/x', after: null }]);
});

test('JSON Pointer escapes tilde and slash, including empty keys', () => {
  assert.deepEqual(compareJson({ 'a/b~c': { '': 1 } }, { 'a/b~c': { '': 2 } }).changes[0].path, '/a~1b~0c/');
});

test('prototype-like keys are compared as data without changing global objects', () => {
  const value = JSON.parse('{"__proto__":{"sample":true}}');
  assert.deepEqual(compareJson({}, value).changes[0], { kind: 'added', path: '/__proto__', after: { sample: true } });
  assert.equal({}.sample, undefined);
});

test('change limits distinguish exact output from real truncation', () => {
  assert.equal(compareJson({ a: 1, b: 1 }, { a: 2, b: 1 }, { maxChanges: 1 }).truncated, false);
  const result = compareJson({ a: 1, b: 1 }, { a: 2, b: 2 }, { maxChanges: 1 });
  assert.equal(result.truncated, true);
  assert.equal(result.changes.length, 1);
  assert.equal(result.equal, false);
});

test('input values remain unchanged', () => {
  const a = { x: [3, 2, 1] }, b = { x: [1, 2, 3] };
  const before = JSON.stringify([a, b]);
  compareJson(a, b);
  assert.equal(JSON.stringify([a, b]), before);
});

test('rejects unsafe numbers, non-JSON values and invalid output limits', () => {
  for (const value of [Infinity, NaN, 9007199254740992, undefined, new Date()]) assert.throws(() => compareJson(value, null));
  for (const maxChanges of [0, 1001, 1.5]) assert.throws(() => compareJson({}, {}, { maxChanges }));
});

test('depth and node limits fail explicitly even for root-type changes', () => {
  let deep = null;
  for (let index = 0; index < 130; index++) deep = { next: deep };
  assert.throws(() => compareJson(deep, 1), /depth limit/);
  assert.throws(() => compareJson(Array(100_001).fill(null), null), /node limit/);
});
