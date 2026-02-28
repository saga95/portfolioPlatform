import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamoSubscriptionRepository } from './dynamo-subscription-repository.js';
import {
  Subscription,
  SubscriptionId,
  TenantId,
} from '@promptdeploy/core';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const mockSend = vi.fn();
const mockDocClient = { send: mockSend } as unknown as DynamoDBDocumentClient;

describe('DynamoSubscriptionRepository', () => {
  let repo: DynamoSubscriptionRepository;
  const tableName = 'test-subscriptions';

  const tenantId = TenantId.create('tenant_abc123') as TenantId;
  const subscriptionId = SubscriptionId.create('sub_abc123') as SubscriptionId;

  const testSubscription = Subscription.create({
    subscriptionId,
    tenantId,
    plan: 'pro',
    currentPeriodStart: '2025-01-01T00:00:00.000Z',
    currentPeriodEnd: '2025-02-01T00:00:00.000Z',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoSubscriptionRepository(mockDocClient, tableName);
  });

  describe('save', () => {
    it('should put item with correct key schema', async () => {
      mockSend.mockResolvedValue({});

      await repo.save(testSubscription);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const putInput = mockSend.mock.calls[0][0].input;
      expect(putInput.TableName).toBe(tableName);
      expect(putInput.Item.PK).toBe('TENANT#tenant_abc123');
      expect(putInput.Item.SK).toBe('SUBSCRIPTION#sub_abc123');
      expect(putInput.Item.GSI1PK).toBe('TENANT#tenant_abc123');
      expect(putInput.Item.GSI1SK).toContain('SUBSCRIPTION#trialing#');
      expect(putInput.Item.entityType).toBe('SUBSCRIPTION');
      expect(putInput.Item.status).toBe('trialing');
      expect(putInput.Item.plan).toBe('pro');
    });
  });

  describe('findById', () => {
    it('should return Subscription when found', async () => {
      mockSend.mockResolvedValue({
        Item: {
          PK: 'TENANT#tenant_abc123',
          SK: 'SUBSCRIPTION#sub_abc123',
          subscriptionId: 'sub_abc123',
          tenantId: 'tenant_abc123',
          plan: 'pro',
          status: 'active',
          currentPeriodStart: '2025-01-01T00:00:00.000Z',
          currentPeriodEnd: '2025-02-01T00:00:00.000Z',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          payhereSubscriptionId: 'ph_sub_999',
        },
      });

      const result = await repo.findById(tenantId, subscriptionId);

      expect(result).not.toBeNull();
      expect(result!.subscriptionId.value).toBe('sub_abc123');
      expect(result!.status).toBe('active');
      expect(result!.plan).toBe('pro');
      expect(result!.payhereSubscriptionId).toBe('ph_sub_999');
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await repo.findById(tenantId, subscriptionId);

      expect(result).toBeNull();
    });
  });

  describe('findActiveByTenantId', () => {
    it('should return null when no active subscription', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await repo.findActiveByTenantId(tenantId);

      expect(result).toBeNull();
    });

    it('should return active subscription when found', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            subscriptionId: 'sub_active1',
            tenantId: 'tenant_abc123',
            plan: 'pro',
            status: 'active',
            currentPeriodStart: '2025-01-01T00:00:00.000Z',
            currentPeriodEnd: '2025-02-01T00:00:00.000Z',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      });

      const result = await repo.findActiveByTenantId(tenantId);

      expect(result).not.toBeNull();
      expect(result!.subscriptionId.value).toBe('sub_active1');
      expect(result!.status).toBe('active');
    });
  });

  describe('findByTenantId', () => {
    it('should return list of subscriptions', async () => {
      mockSend.mockResolvedValue({
        Items: [
          {
            subscriptionId: 'sub_111',
            tenantId: 'tenant_abc123',
            plan: 'pro',
            status: 'active',
            currentPeriodStart: '2025-01-01T00:00:00.000Z',
            currentPeriodEnd: '2025-02-01T00:00:00.000Z',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        LastEvaluatedKey: undefined,
      });

      const result = await repo.findByTenantId(tenantId);

      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].subscriptionId.value).toBe('sub_111');
      expect(result.nextToken).toBeUndefined();
    });

    it('should return nextToken when more items exist', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: { PK: 'x', SK: 'y', GSI1PK: 'a', GSI1SK: 'b' },
      });

      const result = await repo.findByTenantId(tenantId);

      expect(result.nextToken).toBeDefined();
      expect(typeof result.nextToken).toBe('string');
    });

    it('should use GSI1 index with correct key condition', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await repo.findByTenantId(tenantId);

      const queryInput = mockSend.mock.calls[0][0].input;
      expect(queryInput.IndexName).toBe('GSI1');
      expect(queryInput.KeyConditionExpression).toContain('GSI1PK');
      expect(queryInput.ExpressionAttributeValues[':gsi1pk']).toBe('TENANT#tenant_abc123');
      expect(queryInput.ExpressionAttributeValues[':skPrefix']).toBe('SUBSCRIPTION#');
    });
  });

  describe('findByPayhereSubscriptionId', () => {
    it('should return subscription when found by PayHere ID', async () => {
      mockSend.mockResolvedValue({
        Items: [
          {
            subscriptionId: 'sub_found1',
            tenantId: 'tenant_abc123',
            payhereSubscriptionId: 'ph_sub_999',
            plan: 'team',
            status: 'active',
            currentPeriodStart: '2025-01-01T00:00:00.000Z',
            currentPeriodEnd: '2025-02-01T00:00:00.000Z',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      });

      const result = await repo.findByPayhereSubscriptionId('ph_sub_999');

      expect(result).not.toBeNull();
      expect(result!.subscriptionId.value).toBe('sub_found1');
      expect(result!.payhereSubscriptionId).toBe('ph_sub_999');
    });

    it('should return null when not found by PayHere ID', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await repo.findByPayhereSubscriptionId('ph_nonexistent');

      expect(result).toBeNull();
    });
  });
});
