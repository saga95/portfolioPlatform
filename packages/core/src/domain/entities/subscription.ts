import type { SubscriptionStatus, Plan } from '@promptdeploy/shared-types';
import { SubscriptionId } from '../value-objects/subscription-id.js';
import { TenantId } from '../value-objects/tenant-id.js';
import { InvalidSubscriptionTransitionError } from '../errors/index.js';

/**
 * Valid state transitions for a Subscription.
 *
 * trialing → active → cancelled
 *                    → past_due → active (retry payment)
 *                                → cancelled
 * active → cancelled
 */
const VALID_TRANSITIONS: Record<SubscriptionStatus, Set<SubscriptionStatus>> = {
  trialing: new Set(['active', 'cancelled']),
  active: new Set(['past_due', 'cancelled']),
  past_due: new Set(['active', 'cancelled']),
  cancelled: new Set([]), // terminal
};

export interface CreateSubscriptionProps {
  readonly subscriptionId: SubscriptionId;
  readonly tenantId: TenantId;
  readonly plan: Plan;
  readonly currentPeriodStart: string;
  readonly currentPeriodEnd: string;
}

export interface ReconstituteSubscriptionProps extends CreateSubscriptionProps {
  readonly payhereSubscriptionId?: string;
  readonly status: SubscriptionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly cancelledAt?: string;
}

/**
 * Subscription aggregate root.
 *
 * Manages the lifecycle of a tenant's billing subscription
 * integrated with PayHere recurring payments.
 *
 * All mutations return new immutable instances.
 */
export class Subscription {
  private constructor(
    public readonly subscriptionId: SubscriptionId,
    public readonly tenantId: TenantId,
    public readonly payhereSubscriptionId: string | undefined,
    public readonly plan: Plan,
    public readonly status: SubscriptionStatus,
    public readonly currentPeriodStart: string,
    public readonly currentPeriodEnd: string,
    public readonly createdAt: string,
    public readonly updatedAt: string,
    public readonly cancelledAt: string | undefined,
  ) {
    Object.freeze(this);
  }

  /**
   * Factory: create a new subscription (starts as trialing).
   */
  static create(props: CreateSubscriptionProps): Subscription {
    const now = new Date().toISOString();
    return new Subscription(
      props.subscriptionId,
      props.tenantId,
      undefined,
      props.plan,
      'trialing',
      props.currentPeriodStart,
      props.currentPeriodEnd,
      now,
      now,
      undefined,
    );
  }

  /**
   * Reconstitute from persistence (no validation, no defaults).
   */
  static reconstitute(props: ReconstituteSubscriptionProps): Subscription {
    return new Subscription(
      props.subscriptionId,
      props.tenantId,
      props.payhereSubscriptionId,
      props.plan,
      props.status,
      props.currentPeriodStart,
      props.currentPeriodEnd,
      props.createdAt,
      props.updatedAt,
      props.cancelledAt,
    );
  }

  /**
   * Activate subscription (after first successful payment).
   */
  activate(payhereSubscriptionId?: string): Subscription {
    this.guardTransition('active');
    return new Subscription(
      this.subscriptionId,
      this.tenantId,
      payhereSubscriptionId ?? this.payhereSubscriptionId,
      this.plan,
      'active',
      this.currentPeriodStart,
      this.currentPeriodEnd,
      this.createdAt,
      new Date().toISOString(),
      this.cancelledAt,
    );
  }

  /**
   * Mark subscription as past due (payment failed).
   */
  markPastDue(): Subscription {
    this.guardTransition('past_due');
    return new Subscription(
      this.subscriptionId,
      this.tenantId,
      this.payhereSubscriptionId,
      this.plan,
      'past_due',
      this.currentPeriodStart,
      this.currentPeriodEnd,
      this.createdAt,
      new Date().toISOString(),
      this.cancelledAt,
    );
  }

  /**
   * Cancel subscription.
   */
  cancel(): Subscription {
    this.guardTransition('cancelled');
    const now = new Date().toISOString();
    return new Subscription(
      this.subscriptionId,
      this.tenantId,
      this.payhereSubscriptionId,
      this.plan,
      'cancelled',
      this.currentPeriodStart,
      this.currentPeriodEnd,
      this.createdAt,
      now,
      now,
    );
  }

  /**
   * Renew period (update period dates after successful recurring payment).
   */
  renewPeriod(periodStart: string, periodEnd: string): Subscription {
    return new Subscription(
      this.subscriptionId,
      this.tenantId,
      this.payhereSubscriptionId,
      this.plan,
      this.status,
      periodStart,
      periodEnd,
      this.createdAt,
      new Date().toISOString(),
      this.cancelledAt,
    );
  }

  /**
   * Change plan.
   */
  changePlan(newPlan: Plan): Subscription {
    return new Subscription(
      this.subscriptionId,
      this.tenantId,
      this.payhereSubscriptionId,
      newPlan,
      this.status,
      this.currentPeriodStart,
      this.currentPeriodEnd,
      this.createdAt,
      new Date().toISOString(),
      this.cancelledAt,
    );
  }

  private guardTransition(to: SubscriptionStatus): void {
    const allowed = VALID_TRANSITIONS[this.status];
    if (!allowed || !allowed.has(to)) {
      throw new InvalidSubscriptionTransitionError(this.status, to);
    }
  }
}
