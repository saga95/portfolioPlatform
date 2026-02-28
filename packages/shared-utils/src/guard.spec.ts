import { describe, it, expect } from 'vitest';
import { Guard } from './guard.js';

describe('Guard', () => {
  describe('againstNullOrUndefined', () => {
    it('should throw when value is null', () => {
      expect(() => Guard.againstNullOrUndefined(null, 'field')).toThrow('field is required');
    });

    it('should throw when value is undefined', () => {
      expect(() => Guard.againstNullOrUndefined(undefined, 'field')).toThrow('field is required');
    });

    it('should not throw for valid values', () => {
      expect(() => Guard.againstNullOrUndefined('hello', 'field')).not.toThrow();
      expect(() => Guard.againstNullOrUndefined(0, 'field')).not.toThrow();
      expect(() => Guard.againstNullOrUndefined(false, 'field')).not.toThrow();
    });
  });

  describe('againstEmpty', () => {
    it('should throw for empty strings', () => {
      expect(() => Guard.againstEmpty('', 'name')).toThrow('name must not be empty');
      expect(() => Guard.againstEmpty('   ', 'name')).toThrow('name must not be empty');
    });

    it('should not throw for non-empty strings', () => {
      expect(() => Guard.againstEmpty('hello', 'name')).not.toThrow();
    });
  });

  describe('againstLengthExceeded', () => {
    it('should throw when length is exceeded', () => {
      expect(() => Guard.againstLengthExceeded('abcdef', 5, 'field')).toThrow(
        'field must not exceed 5 characters',
      );
    });

    it('should not throw when within limit', () => {
      expect(() => Guard.againstLengthExceeded('abc', 5, 'field')).not.toThrow();
    });
  });

  describe('isOneOf', () => {
    it('should throw when value is not in list', () => {
      expect(() => Guard.isOneOf('x', ['a', 'b', 'c'], 'field')).toThrow(
        'field must be one of: a, b, c',
      );
    });

    it('should not throw when value is in list', () => {
      expect(() => Guard.isOneOf('b', ['a', 'b', 'c'], 'field')).not.toThrow();
    });
  });
});
