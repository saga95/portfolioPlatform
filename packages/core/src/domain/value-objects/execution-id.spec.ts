import { describe, it, expect } from 'vitest';
import { ExecutionId } from './execution-id.js';

describe('ExecutionId', () => {
  it('should create a valid ExecutionId', () => {
    const id = ExecutionId.create('exec_abc123');
    expect(id.value).toBe('exec_abc123');
  });

  it('should throw for empty value', () => {
    expect(() => ExecutionId.create('')).toThrow('ExecutionId must not be empty');
  });

  it('should throw for whitespace-only value', () => {
    expect(() => ExecutionId.create('   ')).toThrow('ExecutionId must not be empty');
  });

  it('should throw for missing prefix', () => {
    expect(() => ExecutionId.create('abc123')).toThrow('ExecutionId must start with "exec_"');
  });

  it('should support equality comparison', () => {
    const a = ExecutionId.create('exec_abc');
    const b = ExecutionId.create('exec_abc');
    const c = ExecutionId.create('exec_xyz');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('should convert to string', () => {
    const id = ExecutionId.create('exec_test');
    expect(id.toString()).toBe('exec_test');
  });
});
