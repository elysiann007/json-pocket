const MAX_DEPTH = 128;
const MAX_NODES = 100_000;

function validate(value) {
  const stack = [{ value, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const frame = stack.pop();
    if (++count > MAX_NODES) throw new Error('JSON exceeds the 100000-node limit.');
    if (frame.depth > MAX_DEPTH) throw new Error('JSON exceeds the 128-level depth limit.');
    const item = frame.value;
    if (item === null || typeof item === 'string' || typeof item === 'boolean') continue;
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item))) {
        throw new Error('Numbers must be finite; encode integers outside the safe range as strings.');
      }
      continue;
    }
    if (typeof item !== 'object' ||
        (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)) {
      throw new Error('Inputs must contain JSON values only.');
    }
    const keys = Object.keys(item);
    if (count + stack.length + keys.length > MAX_NODES) throw new Error('JSON exceeds the 100000-node limit.');
    for (const key of keys) stack.push({ value: item[key], depth: frame.depth + 1 });
  }
}

const token = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const kind = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

export function compareJson(before, after, { maxChanges = 1000 } = {}) {
  if (!Number.isInteger(maxChanges) || maxChanges < 1 || maxChanges > 1000) {
    throw new Error('maxChanges must be an integer from 1 to 1000.');
  }
  validate(before);
  validate(after);
  const changes = [];
  const stack = [{ before, after, beforeExists: true, afterExists: true, path: '' }];
  while (stack.length) {
    const frame = stack.pop();
    const { before: a, after: b, path } = frame;
    let change;
    if (!frame.beforeExists) change = { kind: 'added', path, after: b };
    else if (!frame.afterExists) change = { kind: 'removed', path, before: a };
    else if (a === b) continue;
    else if (kind(a) !== kind(b) || a === null || typeof a !== 'object') {
      change = { kind: 'changed', path, before: a, after: b };
    } else {
      const keys = Array.isArray(a)
        ? Array.from({ length: Math.max(a.length, b.length) }, (_, index) => String(index))
        : [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (let index = keys.length - 1; index >= 0; index--) {
        const key = keys[index];
        stack.push({
          before: a[key], after: b[key],
          beforeExists: Object.hasOwn(a, key), afterExists: Object.hasOwn(b, key),
          path: path + '/' + token(key)
        });
      }
      continue;
    }
    if (changes.length === maxChanges) return { equal: false, changes, truncated: true };
    changes.push(change);
  }
  return { equal: changes.length === 0, changes, truncated: false };
}
