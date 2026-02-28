import { describe, it, expect } from 'vitest';
import { ProjectId } from './project-id.js';

describe('ProjectId', () => {
  it('should create a valid ProjectId from a prefixed string', () => {
    const id = ProjectId.create('proj_abc-123');
    expect(id.value).toBe('proj_abc-123');
  });

  it('should reject empty strings', () => {
    expect(() => ProjectId.create('')).toThrow('ProjectId must not be empty');
  });

  it('should reject strings without the proj_ prefix', () => {
    expect(() => ProjectId.create('abc-123')).toThrow('ProjectId must start with "proj_"');
  });

  it('should support equality comparison', () => {
    const id1 = ProjectId.create('proj_abc-123');
    const id2 = ProjectId.create('proj_abc-123');
    expect(id1.equals(id2)).toBe(true);
  });
});
