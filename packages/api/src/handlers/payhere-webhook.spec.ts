import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makePayHereWebhookHandler } from './payhere-webhook.js';
import type { SubscriptionRepository } from '@promptdeploy/core';
import type { WebhookHashGenerator } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Subscription, SubscriptionId, TenantId } from '@promptdeploy/core';

const mockSubscription = Subscription.create({
  subscriptionId: SubscriptionId.create('sub_test123'),
  tenantId: TenantId.create('tenant_abc'),
  plan: 'pro',
  currentPeriodStart: '2025-01-01T00:00:00.000Z',
  currentPeriodEnd: '2025-02-01T00:00:00.000Z',
});

function makeWebhookEvent(body: Record<string, string>): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/billing/webhook',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: Object.entries(body)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&'),
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
  } as APIGatewayProxyEvent;
}

const mockContext = {} as Context;
const callback = vi.fn();

describe('PayHere Webhook Handler', () => {
  let mockSubRepo: SubscriptionRepository;
  let mockHashGen: WebhookHashGenerator;
  const merchantId = 'test_merchant';
  const merchantSecret = 'test_secret';

  beforeEach(() => {
    mockSubRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockSubscription),
      findActiveByTenantId: vi.fn().mockResolvedValue(null),
      findByTenantId: vi.fn().mockResolvedValue({ subscriptions: [], nextToken: undefined }),
      findByPayhereSubscriptionId: vi.fn().mockResolvedValue(null),
    };
    mockHashGen = {
      md5: vi.fn().mockImplementation((input: string) => {
        if (input === merchantSecret) return 'secrethash';
        return 'VALID_SIG';
      }),
    };
  });

  it('should return 200 on valid webhook with AUTHORIZATION_SUCCESS', async () => {
    const handler = makePayHereWebhookHandler(mockSubRepo, merchantId, merchantSecret, mockHashGen);
    const response = await handler(
      makeWebhookEvent({
        merchant_id: merchantId,
        order_id: 'sub_test123',
        payment_id: 'pay_001',
        subscription_id: 'ph_sub_999',
        payhere_amount: '29.00',
        payhere_currency: 'USD',
        status_code: '2',
        md5sig: 'VALID_SIG',
        message_type: 'AUTHORIZATION_SUCCESS',
        custom_1: 'tenant_abc',
        custom_2: 'sub_test123',
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.received).toBe(true);
    expect(mockSubRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should return 403 on invalid md5sig', async () => {
    mockHashGen = {
      md5: vi.fn().mockReturnValue('different_hash'),
    };

    const handler = makePayHereWebhookHandler(mockSubRepo, merchantId, merchantSecret, mockHashGen);
    const response = await handler(
      makeWebhookEvent({
        merchant_id: merchantId,
        order_id: 'sub_test123',
        payment_id: 'pay_001',
        payhere_amount: '29.00',
        payhere_currency: 'USD',
        status_code: '2',
        md5sig: 'INVALID_SIG',
        custom_1: 'tenant_abc',
        custom_2: 'sub_test123',
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(403);
  });

  it('should return 400 when required fields are missing', async () => {
    const handler = makePayHereWebhookHandler(mockSubRepo, merchantId, merchantSecret, mockHashGen);
    const response = await handler(
      makeWebhookEvent({
        merchant_id: merchantId,
        // Missing required fields
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should handle base64 encoded body', async () => {
    const handler = makePayHereWebhookHandler(mockSubRepo, merchantId, merchantSecret, mockHashGen);
    const formBody = Object.entries({
      merchant_id: merchantId,
      order_id: 'sub_test123',
      payment_id: 'pay_001',
      payhere_amount: '29.00',
      payhere_currency: 'USD',
      status_code: '2',
      md5sig: 'VALID_SIG',
      message_type: 'AUTHORIZATION_SUCCESS',
      custom_1: 'tenant_abc',
      custom_2: 'sub_test123',
    })
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const event = {
      httpMethod: 'POST',
      path: '/billing/webhook',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: Buffer.from(formBody).toString('base64'),
      isBase64Encoded: true,
      pathParameters: null,
      queryStringParameters: null,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {} as APIGatewayProxyEvent['requestContext'],
      resource: '',
    } as APIGatewayProxyEvent;

    const response = await handler(event, mockContext, callback);
    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);
  });
});
