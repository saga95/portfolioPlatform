import { describe, it, expect } from 'vitest';
import { DeploymentId } from './deployment-id.js';

describe('DeploymentId', () => {
  it('should create a valid DeploymentId', () => {
    const id = DeploymentId.create('deploy_abc123');
    expect(id.value).toBe('deploy_abc123');
  });

  it('should throw for empty value', () => {
    expect(() => DeploymentId.create('')).toThrow('DeploymentId must not be empty');
  });

  it('should throw for whitespace-only value', () => {
    expect(() => DeploymentId.create('   ')).toThrow('DeploymentId must not be empty');
  });

  it('should throw for missing prefix', () => {
    expect(() => DeploymentId.create('abc123')).toThrow('DeploymentId must start with "deploy_"');
  });

  it('should support equality comparison', () => {
    const a = DeploymentId.create('deploy_abc');
    const b = DeploymentId.create('deploy_abc');
    const c = DeploymentId.create('deploy_xyz');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('should convert to string', () => {
    const id = DeploymentId.create('deploy_test');
    expect(id.toString()).toBe('deploy_test');
  });
});
