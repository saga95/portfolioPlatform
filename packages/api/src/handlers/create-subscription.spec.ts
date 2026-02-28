import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCreateSubscriptionHandler } from './create-subscription.js';
import type { SubscriptionRepository, IdGenerator } from '@promptdeploy/core';
import type { PayHereConfig, HashGenerator } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/subscriptions',
    headers: {
      'x-tenant-id': 'tenant_abc123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan: 'pro' }),
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
    ...overrides,
  } as APIGatewayProxyEvent;
}

const mockContext = {} as Context;
const callback = vi.fn();

describe('CreateSubscription Handler', () => {
  let mockSubRepo: SubscriptionRepository;
  let mockIdGen: IdGenerator;
  let mockHashGen: HashGenerator;
  let payhereConfig: PayHereConfig;

  beforeEach(() => {
    mockSubRepo = {
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
      md5: vi.fn().mockReturnValue('hashvalue'),
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

  it('should return 201 with checkout session on success', async () => {
    const handler = makeCreateSubscriptionHandler(mockSubRepo, mockIdGen, payhereConfig, mockHashGen);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(201);

    const body = JSON.parse(res.body);
    expect(body.subscriptionId).toBe('sub_generated123');
    expect(body.actionUrl).toBe('https://sandbox.payhere.lk/pay/checkout');
    expect(body.params.merchant_id).toBe('test_merchant');
    expect(body.params.amount).toBe('29.00');
  });

  it('should return 400 when x-tenant-id header is missing', async () => {
    const handler = makeCreateSubscriptionHandler(mockSubRepo, mockIdGen, payhereConfig, mockHashGen);
    const response = await handler(
      makeEvent({ headers: { 'Content-Type': 'application/json' } }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when plan is invalid', async () => {
    const handler = makeCreateSubscriptionHandler(mockSubRepo, mockIdGen, payhereConfig, mockHashGen);
    const response = await handler(
      makeEvent({ body: JSON.stringify({ plan: 'free' }) }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 409 when active subscription already exists', async () => {
    (mockSubRepo.findActiveByTenantId as ReturnType<typeof vi.fn>).mockResolvedValue({
      subscriptionId: { value: 'sub_existing' },
      status: 'active',
    });

    const handler = makeCreateSubscriptionHandler(mockSubRepo, mockIdGen, payhereConfig, mockHashGen);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(409);
  });
});
