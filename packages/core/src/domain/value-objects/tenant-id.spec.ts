import { describe, it, expect } from 'vitest';
import { TenantId } from './tenant-id.js';

describe('TenantId', () => {
  it('should create a valid TenantId from a prefixed string', () => {
    const id = TenantId.create('tenant_abc-123');
    expect(id.value).toBe('tenant_abc-123');
  });

  it('should reject empty strings', () => {
    expect(() => TenantId.create('')).toThrow('TenantId must not be empty');
  });

  it('should reject strings without the tenant_ prefix', () => {
    expect(() => TenantId.create('abc-123')).toThrow('TenantId must start with "tenant_"');
  });

  it('should support equality comparison', () => {
    const id1 = TenantId.create('tenant_abc-123');
    const id2 = TenantId.create('tenant_abc-123');
    const id3 = TenantId.create('tenant_xyz-789');
    expect(id1.equals(id2)).toBe(true);
    expect(id1.equals(id3)).toBe(false);
  });

  it('should be immutable via toString()', () => {
    const id = TenantId.create('tenant_abc-123');
    expect(id.toString()).toBe('tenant_abc-123');
  });
});
