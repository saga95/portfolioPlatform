import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateSubscriptionUseCase } from './create-subscription.js';
import type { SubscriptionRepository } from '../../domain/ports/subscription-repository.js';
import type { IdGenerator } from '../../domain/ports/id-generator.js';
import type { PayHereConfig, HashGenerator } from './create-subscription.js';

describe('CreateSubscriptionUseCase', () => {
  let mockRepo: SubscriptionRepository;
  let mockIdGen: IdGenerator;
  let mockHashGen: HashGenerator;
  let payhereConfig: PayHereConfig;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findActiveByTenantId: vi.fn().mockResolvedValue(null),
      findByTenantId: vi.fn().mockResolvedValue({ subscriptions: [], nextToken: undefined }),
      findByPayhereSubscriptionId: vi.fn().mockResolvedValue(null),
    };
    mockIdGen = {
      generate: vi.fn().mockReturnValue('sub_generated123'),
    };
    mockHashGen = {
      md5: vi.fn().mockReturnValue('abc123hash'),
    };
    payhereConfig = {
      merchantId: 'test_merchant',
      merchantSecret: 'test_secret',
      notifyUrl: 'https://api.example.com/billing/webhook',
      returnUrl: 'https://app.example.com/billing/success',
      cancelUrl: 'https://app.example.com/billing/cancel',
      sandbox: true,
    };
  });

  it('should create a subscription and return checkout session', async () => {
    const useCase = new CreateSubscriptionUseCase(mockRepo, mockIdGen, payhereConfig, mockHashGen);
    const result = await useCase.execute({
      tenantId: 'tenant_abc123',
      plan: 'pro',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.subscriptionId).toBe('sub_generated123');
      expect(result.value.actionUrl).toBe('https://sandbox.payhere.lk/pay/checkout');
      expect(result.value.params.merchant_id).toBe('test_merchant');
      expect(result.value.params.amount).toBe('29.00');
      expect(result.value.params.currency).toBe('USD');
      expect(result.value.params.recurrence).toBe('1 Month');
      expect(result.value.params.duration).toBe('Forever');
      expect(result.value.params.custom_1).toBe('tenant_abc123');
      expect(result.value.params.custom_2).toBe('sub_generated123');
    }
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should use production URL when sandbox is false', async () => {
    payhereConfig.sandbox = false;
    const useCase = new CreateSubscriptionUseCase(mockRepo, mockIdGen, payhereConfig, mockHashGen);
    const result = await useCase.execute({
      tenantId: 'tenant_abc123',
      plan: 'pro',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actionUrl).toBe('https://www.payhere.lk/pay/checkout');
    }
  });

  it('should fail if an active subscription already exists', async () => {
    (mockRepo.findActiveByTenantId as ReturnType<typeof vi.fn>).mockResolvedValue({
      subscriptionId: { value: 'sub_existing' },
      status: 'active',
    });

    const useCase = new CreateSubscriptionUseCase(mockRepo, mockIdGen, payhereConfig, mockHashGen);
    const result = await useCase.execute({
      tenantId: 'tenant_abc123',
      plan: 'pro',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SUBSCRIPTION_ALREADY_EXISTS');
    }
  });

  it('should fail for an invalid plan (free)', async () => {
    const useCase = new CreateSubscriptionUseCase(mockRepo, mockIdGen, payhereConfig, mockHashGen);
    const result = await useCase.execute({
      tenantId: 'tenant_abc123',
      plan: 'free',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should set correct pricing for team plan', async () => {
    const useCase = new CreateSubscriptionUseCase(mockRepo, mockIdGen, payhereConfig, mockHashGen);
    const result = await useCase.execute({
      tenantId: 'tenant_abc123',
      plan: 'team',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.params.amount).toBe('79.00');
    }
  });

  it('should set correct pricing for enterprise plan', async () => {
    const useCase = new CreateSubscriptionUseCase(mockRepo, mockIdGen, payhereConfig, mockHashGen);
    const result = await useCase.execute({
      tenantId: 'tenant_abc123',
      plan: 'enterprise',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.params.amount).toBe('199.00');
    }
  });
});
