import { ValueObject } from './value-object.js';

export class TenantId extends ValueObject<string> {
  private static readonly PREFIX = 'tenant_';

  private constructor(value: string) {
    super(value);
  }

  static create(value: string): TenantId {
    if (!value || value.trim().length === 0) {
      throw new Error('TenantId must not be empty');
    }
    if (!value.startsWith(TenantId.PREFIX)) {
      throw new Error('TenantId must start with "tenant_"');
    }
    return new TenantId(value);
  }
}
