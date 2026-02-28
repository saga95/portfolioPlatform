import { describe, it, expect } from 'vitest';
import { Subscription } from './subscription.js';
import { SubscriptionId } from '../value-objects/subscription-id.js';
import { TenantId } from '../value-objects/tenant-id.js';
import { InvalidSubscriptionTransitionError } from '../errors/index.js';

function makeSubscription(overrides?: { status?: string }) {
  const sub = Subscription.create({
    subscriptionId: SubscriptionId.create('sub_test123'),
    tenantId: TenantId.create('tenant_abc'),
    plan: 'pro',
    currentPeriodStart: '2025-01-01T00:00:00.000Z',
    currentPeriodEnd: '2025-02-01T00:00:00.000Z',
  });

  if (overrides?.status === 'active') {
    return sub.activate('payhere_sub_1');
  }
  if (overrides?.status === 'past_due') {
    return sub.activate('payhere_sub_1').markPastDue();
  }
  return sub;
}

describe('Subscription Entity', () => {
  describe('create', () => {
    it('should create a subscription in trialing status', () => {
      const sub = makeSubscription();
      expect(sub.status).toBe('trialing');
      expect(sub.plan).toBe('pro');
      expect(sub.subscriptionId.value).toBe('sub_test123');
      expect(sub.tenantId.value).toBe('tenant_abc');
      expect(sub.payhereSubscriptionId).toBeUndefined();
      expect(sub.cancelledAt).toBeUndefined();
    });

    it('should freeze the entity', () => {
      const sub = makeSubscription();
      expect(Object.isFrozen(sub)).toBe(true);
    });
  });

  describe('activate', () => {
    it('should transition from trialing to active', () => {
      const sub = makeSubscription();
      const activated = sub.activate('ph_sub_123');
      expect(activated.status).toBe('active');
      expect(activated.payhereSubscriptionId).toBe('ph_sub_123');
    });

    it('should transition from past_due to active', () => {
      const sub = makeSubscription({ status: 'past_due' });
      const activated = sub.activate();
      expect(activated.status).toBe('active');
    });

    it('should throw when activating from cancelled', () => {
      const sub = makeSubscription({ status: 'active' }).cancel();
      expect(() => sub.activate()).toThrow(InvalidSubscriptionTransitionError);
    });
  });

  describe('markPastDue', () => {
    it('should transition from active to past_due', () => {
      const sub = makeSubscription({ status: 'active' });
      const pastDue = sub.markPastDue();
      expect(pastDue.status).toBe('past_due');
    });

    it('should throw when marking trialing as past_due', () => {
      const sub = makeSubscription();
      expect(() => sub.markPastDue()).toThrow(InvalidSubscriptionTransitionError);
    });
  });

  describe('cancel', () => {
    it('should transition from active to cancelled', () => {
      const sub = makeSubscription({ status: 'active' });
      const cancelled = sub.cancel();
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledAt).toBeDefined();
    });

    it('should transition from trialing to cancelled', () => {
      const sub = makeSubscription();
      const cancelled = sub.cancel();
      expect(cancelled.status).toBe('cancelled');
    });

    it('should transition from past_due to cancelled', () => {
      const sub = makeSubscription({ status: 'past_due' });
      const cancelled = sub.cancel();
      expect(cancelled.status).toBe('cancelled');
    });

    it('should throw when cancelling already cancelled', () => {
      const sub = makeSubscription({ status: 'active' }).cancel();
      expect(() => sub.cancel()).toThrow(InvalidSubscriptionTransitionError);
    });
  });

  describe('renewPeriod', () => {
    it('should update period dates', () => {
      const sub = makeSubscription({ status: 'active' });
      const renewed = sub.renewPeriod('2025-02-01T00:00:00.000Z', '2025-03-01T00:00:00.000Z');
      expect(renewed.currentPeriodStart).toBe('2025-02-01T00:00:00.000Z');
      expect(renewed.currentPeriodEnd).toBe('2025-03-01T00:00:00.000Z');
    });
  });

  describe('changePlan', () => {
    it('should update the plan', () => {
      const sub = makeSubscription({ status: 'active' });
      const changed = sub.changePlan('team');
      expect(changed.plan).toBe('team');
      expect(changed.status).toBe('active');
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from persistence data', () => {
      const sub = Subscription.reconstitute({
        subscriptionId: SubscriptionId.create('sub_test456'),
        tenantId: TenantId.create('tenant_xyz'),
        payhereSubscriptionId: 'ph_123',
        plan: 'team',
        status: 'active',
        currentPeriodStart: '2025-01-01T00:00:00.000Z',
        currentPeriodEnd: '2025-02-01T00:00:00.000Z',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-15T00:00:00.000Z',
        cancelledAt: undefined,
      });

      expect(sub.subscriptionId.value).toBe('sub_test456');
      expect(sub.payhereSubscriptionId).toBe('ph_123');
      expect(sub.plan).toBe('team');
      expect(sub.status).toBe('active');
    });
  });
});
