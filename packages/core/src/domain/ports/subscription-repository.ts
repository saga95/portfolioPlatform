import type { Subscription } from '../entities/subscription.js';
import type { SubscriptionId } from '../value-objects/subscription-id.js';
import type { TenantId } from '../value-objects/tenant-id.js';

/**
 * Repository port for Subscription aggregate persistence.
 * Domain defines the interface; infrastructure implements it.
 */
export interface SubscriptionRepository {
  /**
   * Save a new or updated subscription.
   */
  save(subscription: Subscription): Promise<void>;

  /**
   * Find a subscription by ID within a tenant scope.
   */
  findById(tenantId: TenantId, subscriptionId: SubscriptionId): Promise<Subscription | null>;

  /**
   * Find the active subscription for a tenant.
   */
  findActiveByTenantId(tenantId: TenantId): Promise<Subscription | null>;

  /**
   * List all subscriptions for a tenant.
   */
  findByTenantId(
    tenantId: TenantId,
    nextToken?: string,
  ): Promise<SubscriptionListResult>;

  /**
   * Find a subscription by PayHere subscription ID (for webhook processing).
   */
  findByPayhereSubscriptionId(payhereSubscriptionId: string): Promise<Subscription | null>;
}

export interface SubscriptionListResult {
  readonly subscriptions: Subscription[];
  readonly nextToken?: string;
}
