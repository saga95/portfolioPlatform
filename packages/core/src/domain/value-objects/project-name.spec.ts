import { describe, it, expect } from 'vitest';
import { ProjectName } from './project-name.js';

describe('ProjectName', () => {
  it('should create a valid ProjectName', () => {
    const name = ProjectName.create('My SaaS App');
    expect(name.value).toBe('My SaaS App');
  });

  it('should reject empty strings', () => {
    expect(() => ProjectName.create('')).toThrow('ProjectName must not be empty');
  });

  it('should reject whitespace-only strings', () => {
    expect(() => ProjectName.create('   ')).toThrow('ProjectName must not be empty');
  });

  it('should reject names exceeding 100 characters', () => {
    const longName = 'a'.repeat(101);
    expect(() => ProjectName.create(longName)).toThrow(
      'ProjectName must not exceed 100 characters',
    );
  });

  it('should trim whitespace', () => {
    const name = ProjectName.create('  My App  ');
    expect(name.value).toBe('My App');
  });

  it('should support equality comparison', () => {
    const n1 = ProjectName.create('App');
    const n2 = ProjectName.create('App');
    const n3 = ProjectName.create('Other');
    expect(n1.equals(n2)).toBe(true);
    expect(n1.equals(n3)).toBe(false);
  });
});
