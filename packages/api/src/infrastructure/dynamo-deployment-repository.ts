import type {
  DeploymentRepository,
  DeploymentListResult,
} from '@promptdeploy/core';
import {
  Deployment,
  DeploymentId,
  TenantId,
  ProjectId,
} from '@promptdeploy/core';
import type { DeploymentStatus } from '@promptdeploy/shared-types';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB key schema utilities for deployments (single-table design).
 *
 * PK:   TENANT#<tenantId>
 * SK:   DEPLOYMENT#<deploymentId>
 * GSI1PK: TENANT#<tenantId>#PROJECT#<projectId>
 * GSI1SK: DEPLOYMENT#<status>#<startedAt>
 */
function makePK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}
function makeSK(deploymentId: string): string {
  return `DEPLOYMENT#${deploymentId}`;
}
function makeGSI1PK(tenantId: string, projectId: string): string {
  return `TENANT#${tenantId}#PROJECT#${projectId}`;
}
function makeGSI1SK(status: string, startedAt: string): string {
  return `DEPLOYMENT#${status}#${startedAt}`;
}

interface DynamoDeploymentItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'DEPLOYMENT';
  deploymentId: string;
  tenantId: string;
  projectId: string;
  version: string;
  status: DeploymentStatus;
  logs: string[];
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  deployedUrl?: string;
}

/**
 * DynamoDB implementation of the DeploymentRepository port.
 * Maps between domain Deployment entities and DynamoDB items.
 */
export class DynamoDeploymentRepository implements DeploymentRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(deployment: Deployment): Promise<void> {
    const item: DynamoDeploymentItem = {
      PK: makePK(deployment.tenantId.value),
      SK: makeSK(deployment.deploymentId.value),
      GSI1PK: makeGSI1PK(deployment.tenantId.value, deployment.projectId.value),
      GSI1SK: makeGSI1SK(deployment.status, deployment.startedAt),
      entityType: 'DEPLOYMENT',
      deploymentId: deployment.deploymentId.value,
      tenantId: deployment.tenantId.value,
      projectId: deployment.projectId.value,
      version: deployment.version,
      status: deployment.status,
      logs: [...deployment.logs],
      startedAt: deployment.startedAt,
      completedAt: deployment.completedAt,
      errorMessage: deployment.errorMessage,
      deployedUrl: deployment.deployedUrl,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async findById(tenantId: TenantId, deploymentId: DeploymentId): Promise<Deployment | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: makePK(tenantId.value),
          SK: makeSK(deploymentId.value),
        },
      }),
    );

    if (!result.Item) return null;

    return this.toDomainEntity(result.Item as DynamoDeploymentItem);
  }

  async findByProjectId(
    tenantId: TenantId,
    projectId: ProjectId,
    nextToken?: string,
  ): Promise<DeploymentListResult> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': makeGSI1PK(tenantId.value, projectId.value),
          ':skPrefix': 'DEPLOYMENT#',
        },
        ExclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
        ScanIndexForward: false, // Newest first
        Limit: 25,
      }),
    );

    const deployments = (result.Items ?? []).map((item) =>
      this.toDomainEntity(item as DynamoDeploymentItem),
    );

    const newNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { deployments, nextToken: newNextToken };
  }

  async findActiveByProjectId(
    tenantId: TenantId,
    projectId: ProjectId,
  ): Promise<Deployment | null> {
    // Query for active deployment statuses
    const activeStatuses = ['pending', 'bootstrapping', 'deploying', 'verifying', 'rolling_back'];

    for (const status of activeStatuses) {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :statusPrefix)',
          ExpressionAttributeValues: {
            ':gsi1pk': makeGSI1PK(tenantId.value, projectId.value),
            ':statusPrefix': `DEPLOYMENT#${status}#`,
          },
          Limit: 1,
        }),
      );

      if (result.Items?.length) {
        return this.toDomainEntity(result.Items[0] as DynamoDeploymentItem);
      }
    }

    return null;
  }

  private toDomainEntity(item: DynamoDeploymentItem): Deployment {
    return Deployment.reconstitute({
      deploymentId: DeploymentId.create(item.deploymentId) as DeploymentId,
      projectId: ProjectId.create(item.projectId) as ProjectId,
      tenantId: TenantId.create(item.tenantId) as TenantId,
      version: item.version,
      status: item.status,
      logs: item.logs ?? [],
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      errorMessage: item.errorMessage,
      deployedUrl: item.deployedUrl,
    });
  }
}
