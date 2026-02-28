import type {
  SubscriptionRepository,
  SubscriptionListResult,
} from '@promptdeploy/core';
import {
  Subscription,
  SubscriptionId,
  TenantId,
} from '@promptdeploy/core';
import type { SubscriptionStatus, Plan } from '@promptdeploy/shared-types';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB key schema utilities for subscriptions (single-table design).
 *
 * PK:   TENANT#<tenantId>
 * SK:   SUBSCRIPTION#<subscriptionId>
 * GSI1PK: TENANT#<tenantId>
 * GSI1SK: SUBSCRIPTION#<status>#<createdAt>
 */
function makePK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}
function makeSK(subscriptionId: string): string {
  return `SUBSCRIPTION#${subscriptionId}`;
}
function makeGSI1PK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}
function makeGSI1SK(status: string, createdAt: string): string {
  return `SUBSCRIPTION#${status}#${createdAt}`;
}

interface DynamoSubscriptionItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'SUBSCRIPTION';
  subscriptionId: string;
  tenantId: string;
  payhereSubscriptionId?: string;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
}

/**
 * DynamoDB implementation of the SubscriptionRepository port.
 * Maps between domain Subscription entities and DynamoDB items.
 */
export class DynamoSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(subscription: Subscription): Promise<void> {
    const item: DynamoSubscriptionItem = {
      PK: makePK(subscription.tenantId.value),
      SK: makeSK(subscription.subscriptionId.value),
      GSI1PK: makeGSI1PK(subscription.tenantId.value),
      GSI1SK: makeGSI1SK(subscription.status, subscription.createdAt),
      entityType: 'SUBSCRIPTION',
      subscriptionId: subscription.subscriptionId.value,
      tenantId: subscription.tenantId.value,
      payhereSubscriptionId: subscription.payhereSubscriptionId,
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      cancelledAt: subscription.cancelledAt,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async findById(tenantId: TenantId, subscriptionId: SubscriptionId): Promise<Subscription | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: makePK(tenantId.value),
          SK: makeSK(subscriptionId.value),
        },
      }),
    );

    if (!result.Item) return null;

    return this.toDomainEntity(result.Item as DynamoSubscriptionItem);
  }

  async findActiveByTenantId(tenantId: TenantId): Promise<Subscription | null> {
    // Query for active subscriptions using GSI1
    const activeStatuses = ['active', 'trialing'];

    for (const status of activeStatuses) {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :statusPrefix)',
          ExpressionAttributeValues: {
            ':gsi1pk': makeGSI1PK(tenantId.value),
            ':statusPrefix': `SUBSCRIPTION#${status}#`,
          },
          Limit: 1,
        }),
      );

      if (result.Items?.length) {
        return this.toDomainEntity(result.Items[0] as DynamoSubscriptionItem);
      }
    }

    return null;
  }

  async findByTenantId(
    tenantId: TenantId,
    nextToken?: string,
  ): Promise<SubscriptionListResult> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': makeGSI1PK(tenantId.value),
          ':skPrefix': 'SUBSCRIPTION#',
        },
        ExclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
        ScanIndexForward: false, // Newest first
        Limit: 25,
      }),
    );

    const subscriptions = (result.Items ?? []).map((item) =>
      this.toDomainEntity(item as DynamoSubscriptionItem),
    );

    const newNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { subscriptions, nextToken: newNextToken };
  }

  async findByPayhereSubscriptionId(payhereSubscriptionId: string): Promise<Subscription | null> {
    // Full table scan with filter — used rarely (webhook processing only)
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'entityType = :entityType AND payhereSubscriptionId = :phSubId',
        ExpressionAttributeValues: {
          ':entityType': 'SUBSCRIPTION',
          ':phSubId': payhereSubscriptionId,
        },
        Limit: 1,
      }),
    );

    if (!result.Items?.length) return null;

    return this.toDomainEntity(result.Items[0] as DynamoSubscriptionItem);
  }

  private toDomainEntity(item: DynamoSubscriptionItem): Subscription {
    return Subscription.reconstitute({
      subscriptionId: SubscriptionId.create(item.subscriptionId) as SubscriptionId,
      tenantId: TenantId.create(item.tenantId) as TenantId,
      payhereSubscriptionId: item.payhereSubscriptionId,
      plan: item.plan,
      status: item.status,
      currentPeriodStart: item.currentPeriodStart,
      currentPeriodEnd: item.currentPeriodEnd,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      cancelledAt: item.cancelledAt,
    });
  }
}
