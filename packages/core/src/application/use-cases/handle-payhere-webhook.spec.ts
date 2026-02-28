import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HandlePayHereWebhookUseCase } from './handle-payhere-webhook.js';
import type { SubscriptionRepository } from '../../domain/ports/subscription-repository.js';
import type { WebhookHashGenerator } from './handle-payhere-webhook.js';
import { Subscription } from '../../domain/entities/subscription.js';
import { SubscriptionId } from '../../domain/value-objects/subscription-id.js';
import { TenantId } from '../../domain/value-objects/tenant-id.js';

function makeTrialingSubscription() {
  return Subscription.create({
    subscriptionId: SubscriptionId.create('sub_test123'),
    tenantId: TenantId.create('tenant_abc'),
    plan: 'pro',
    currentPeriodStart: '2025-01-01T00:00:00.000Z',
    currentPeriodEnd: '2025-02-01T00:00:00.000Z',
  });
}

function makeActiveSubscription() {
  return makeTrialingSubscription().activate('ph_sub_999');
}

describe('HandlePayHereWebhookUseCase', () => {
  let mockRepo: SubscriptionRepository;
  let mockHashGen: WebhookHashGenerator;
  const merchantId = 'test_merchant';
  const merchantSecret = 'test_secret';

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(makeTrialingSubscription()),
      findActiveByTenantId: vi.fn().mockResolvedValue(null),
      findByTenantId: vi.fn().mockResolvedValue({ subscriptions: [], nextToken: undefined }),
      findByPayhereSubscriptionId: vi.fn().mockResolvedValue(null),
    };
    // Hash generator that produces deterministic results for signature verification
    mockHashGen = {
      md5: vi.fn().mockImplementation((input: string) => {
        // Return consistent hash for signature verification to pass
        if (input === merchantSecret) return 'secrethash';
        return 'VALID_SIG';
      }),
    };
  });

  it('should activate subscription on AUTHORIZATION_SUCCESS', async () => {
    const useCase = new HandlePayHereWebhookUseCase(mockRepo, merchantId, merchantSecret, mockHashGen);
    const result = await useCase.execute({
      merchantId,
      orderId: 'sub_test123',
      paymentId: 'pay_001',
      subscriptionId: 'ph_sub_999',
      payhereAmount: '29.00',
      payhereCurrency: 'USD',
      statusCode: '2',
      md5sig: 'VALID_SIG',
      messageType: 'AUTHORIZATION_SUCCESS',
      custom1: 'tenant_abc',
      custom2: 'sub_test123',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('active');
      expect(result.value.payhereSubscriptionId).toBe('ph_sub_999');
    }
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should reject webhook with invalid signature', async () => {
    // Make hash generator return different values so signature doesn't match
    mockHashGen = {
      md5: vi.fn().mockReturnValue('different_hash'),
    };

    const useCase = new HandlePayHereWebhookUseCase(mockRepo, merchantId, merchantSecret, mockHashGen);
    const result = await useCase.execute({
      merchantId,
      orderId: 'sub_test123',
      paymentId: 'pay_001',
      payhereAmount: '29.00',
      payhereCurrency: 'USD',
      statusCode: '2',
      md5sig: 'INVALID_SIG',
      custom1: 'tenant_abc',
      custom2: 'sub_test123',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('PAYHERE_WEBHOOK_VERIFICATION_FAILED');
    }
  });

  it('should cancel subscription on AUTHORIZATION_FAILED', async () => {
    const useCase = new HandlePayHereWebhookUseCase(mockRepo, merchantId, merchantSecret, mockHashGen);
    const result = await useCase.execute({
      merchantId,
      orderId: 'sub_test123',
      paymentId: 'pay_001',
      payhereAmount: '29.00',
      payhereCurrency: 'USD',
      statusCode: '-2',
      md5sig: 'VALID_SIG',
      messageType: 'AUTHORIZATION_FAILED',
      custom1: 'tenant_abc',
      custom2: 'sub_test123',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('cancelled');
    }
  });

  it('should mark past_due on RECURRING_INSTALLMENT_FAILED', async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeActiveSubscription());

    const useCase = new HandlePayHereWebhookUseCase(mockRepo, merchantId, merchantSecret, mockHashGen);
    const result = await useCase.execute({
      merchantId,
      orderId: 'sub_test123',
      paymentId: 'pay_002',
      subscriptionId: 'ph_sub_999',
      payhereAmount: '29.00',
      payhereCurrency: 'USD',
      statusCode: '-2',
      md5sig: 'VALID_SIG',
      messageType: 'RECURRING_INSTALLMENT_FAILED',
      custom1: 'tenant_abc',
      custom2: 'sub_test123',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('past_due');
    }
  });

  it('should cancel subscription on RECURRING_COMPLETE', async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(makeActiveSubscription());

    const useCase = new HandlePayHereWebhookUseCase(mockRepo, merchantId, merchantSecret, mockHashGen);
    const result = await useCase.execute({
      merchantId,
      orderId: 'sub_test123',
      paymentId: 'pay_003',
      payhereAmount: '29.00',
      payhereCurrency: 'USD',
      statusCode: '2',
      md5sig: 'VALID_SIG',
      messageType: 'RECURRING_COMPLETE',
      custom1: 'tenant_abc',
      custom2: 'sub_test123',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('cancelled');
    }
  });

  it('should handle one-time checkout success (no messageType)', async () => {
    const useCase = new HandlePayHereWebhookUseCase(mockRepo, merchantId, merchantSecret, mockHashGen);
    const result = await useCase.execute({
      merchantId,
      orderId: 'sub_test123',
      paymentId: 'pay_001',
      subscriptionId: 'ph_sub_999',
      payhereAmount: '29.00',
      payhereCurrency: 'USD',
      statusCode: '2',
      md5sig: 'VALID_SIG',
      custom1: 'tenant_abc',
      custom2: 'sub_test123',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('active');
    }
  });

  it('should return error when subscription not found', async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const useCase = new HandlePayHereWebhookUseCase(mockRepo, merchantId, merchantSecret, mockHashGen);
    const result = await useCase.execute({
      merchantId,
      orderId: 'sub_nonexistent',
      paymentId: 'pay_001',
      payhereAmount: '29.00',
      payhereCurrency: 'USD',
      statusCode: '2',
      md5sig: 'VALID_SIG',
      custom1: 'tenant_abc',
      custom2: 'sub_nonexistent',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SUBSCRIPTION_NOT_FOUND');
    }
  });
});
