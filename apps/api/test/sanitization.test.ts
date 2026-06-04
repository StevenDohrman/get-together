import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeLikePattern, sanitizeUserInput } from '../src/sanitization.js';

describe('sanitizeUserInput', () => {
  it('trims string input', () => {
    assert.equal(sanitizeUserInput('  hello campus  '), 'hello campus');
  });

  it('returns an empty string for non-string values', () => {
    for (const value of [null, undefined, 42, true, {}, ['hello']]) {
      assert.equal(sanitizeUserInput(value), '');
    }
  });
});

describe('escapeLikePattern', () => {
  it('escapes SQL LIKE wildcards and escape characters', () => {
    assert.equal(escapeLikePattern('100%_ready\\soon'), '100\\%\\_ready\\\\soon');
  });

  it('leaves ordinary search text unchanged', () => {
    assert.equal(escapeLikePattern('study group'), 'study group');
  });
});
