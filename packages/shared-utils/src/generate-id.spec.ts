import { describe, it, expect } from 'vitest';
import { generateId } from './generate-id.js';

describe('generateId', () => {
  it('should return a string prefixed with the given prefix', () => {
    const id = generateId('proj');
    expect(id).toMatch(/^proj_[0-9a-f-]{36}$/);
  });

  it('should generate unique IDs on each call', () => {
    const id1 = generateId('tenant');
    const id2 = generateId('tenant');
    expect(id1).not.toBe(id2);
  });

  it('should support different prefixes', () => {
    const projId = generateId('proj');
    const tenantId = generateId('tenant');
    expect(projId.startsWith('proj_')).toBe(true);
    expect(tenantId.startsWith('tenant_')).toBe(true);
  });
});
