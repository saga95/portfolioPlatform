import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeGetSubscriptionHandler } from './get-subscription.js';
import type { SubscriptionRepository } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Subscription, SubscriptionId, TenantId } from '@promptdeploy/core';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/subscriptions/sub_test123',
    headers: {
      'x-tenant-id': 'tenant_abc123',
    },
    body: null,
    pathParameters: { subscriptionId: 'sub_test123' },
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

const mockSubscription = Subscription.reconstitute({
  subscriptionId: SubscriptionId.create('sub_test123'),
  tenantId: TenantId.create('tenant_abc123'),
  payhereSubscriptionId: 'ph_sub_999',
  plan: 'pro',
  status: 'active',
  currentPeriodStart: '2025-01-01T00:00:00.000Z',
  currentPeriodEnd: '2025-02-01T00:00:00.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  cancelledAt: undefined,
});

describe('GetSubscription Handler', () => {
  let mockSubRepo: SubscriptionRepository;

  beforeEach(() => {
    mockSubRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockSubscription),
      findActiveByTenantId: vi.fn().mockResolvedValue(null),
      findByTenantId: vi.fn().mockResolvedValue({ subscriptions: [], nextToken: undefined }),
      findByPayhereSubscriptionId: vi.fn().mockResolvedValue(null),
    };
  });

  it('should return 200 with subscription DTO on success', async () => {
    const handler = makeGetSubscriptionHandler(mockSubRepo);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.subscriptionId).toBe('sub_test123');
    expect(body.plan).toBe('pro');
    expect(body.status).toBe('active');
  });

  it('should return 404 when subscription not found', async () => {
    (mockSubRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handler = makeGetSubscriptionHandler(mockSubRepo);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 when x-tenant-id header is missing', async () => {
    const handler = makeGetSubscriptionHandler(mockSubRepo);
    const response = await handler(
      makeEvent({ headers: {} }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });
});
