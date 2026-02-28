import { describe, it, expect } from 'vitest';
import { ProjectDescription } from './project-description.js';

describe('ProjectDescription', () => {
  it('should create a valid ProjectDescription', () => {
    const desc = ProjectDescription.create('A platform for managing restaurants');
    expect(desc.value).toBe('A platform for managing restaurants');
  });

  it('should allow empty descriptions', () => {
    const desc = ProjectDescription.create('');
    expect(desc.value).toBe('');
  });

  it('should reject descriptions exceeding 2000 characters', () => {
    const longDesc = 'a'.repeat(2001);
    expect(() => ProjectDescription.create(longDesc)).toThrow(
      'ProjectDescription must not exceed 2000 characters',
    );
  });

  it('should support equality comparison', () => {
    const d1 = ProjectDescription.create('desc');
    const d2 = ProjectDescription.create('desc');
    expect(d1.equals(d2)).toBe(true);
  });
});
