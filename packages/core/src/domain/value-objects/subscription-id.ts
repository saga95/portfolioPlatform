import { ValueObject } from './value-object.js';

/**
 * Unique identifier for a subscription.
 * Format: sub_{uuid}
 */
export class SubscriptionId extends ValueObject<string> {
  private static readonly PREFIX = 'sub_';

  private constructor(value: string) {
    super(value);
  }

  static create(value: string): SubscriptionId {
    if (!value || value.trim().length === 0) {
      throw new Error('SubscriptionId must not be empty');
    }
    if (!value.startsWith(SubscriptionId.PREFIX)) {
      throw new Error('SubscriptionId must start with "sub_"');
    }
    return new SubscriptionId(value);
  }
}
