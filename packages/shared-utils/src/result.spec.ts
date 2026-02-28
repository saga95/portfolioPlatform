import { describe, it, expect } from 'vitest';
import { ok, err } from './result.js';
import type { Result } from './result.js';

describe('Result', () => {
  it('should create a success result', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('should create a failure result', () => {
    const result = err(new Error('something failed'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('something failed');
    }
  });

  it('should narrow types correctly', () => {
    const result: Result<number, Error> = ok(10);
    if (result.ok) {
      const value: number = result.value;
      expect(value).toBe(10);
    }
  });
});
