import type {
  ProjectRepository,
  ProjectListResult,
} from '@promptdeploy/core';
import {
  Project,
  ProjectId,
  TenantId,
  ProjectName,
  ProjectDescription,
} from '@promptdeploy/core';
import type { ProjectStatus } from '@promptdeploy/shared-types';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB key schema utilities for the single-table design.
 */
function makePK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}
function makeSK(projectId: string): string {
  return `PROJECT#${projectId}`;
}
function makeGSI1PK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}
function makeGSI1SK(status: string, updatedAt: string): string {
  return `STATUS#${status}#${updatedAt}`;
}

interface DynamoProjectItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'PROJECT';
  projectId: string;
  tenantId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  templateId: string;
  repoUrl?: string;
  deployedUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DynamoDB implementation of the ProjectRepository port.
 * Maps between domain Project entities and DynamoDB items.
 */
export class DynamoProjectRepository implements ProjectRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(project: Project): Promise<void> {
    const item: DynamoProjectItem = {
      PK: makePK(project.tenantId.value),
      SK: makeSK(project.projectId.value),
      GSI1PK: makeGSI1PK(project.tenantId.value),
      GSI1SK: makeGSI1SK(project.status, project.updatedAt),
      entityType: 'PROJECT',
      projectId: project.projectId.value,
      tenantId: project.tenantId.value,
      name: project.name.value,
      description: project.description.value,
      status: project.status,
      templateId: project.templateId,
      repoUrl: project.repoUrl,
      deployedUrl: project.deployedUrl,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async findById(tenantId: TenantId, projectId: ProjectId): Promise<Project | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: makePK(tenantId.value),
          SK: makeSK(projectId.value),
        },
      }),
    );

    if (!result.Item) return null;

    return this.toDomainEntity(result.Item as DynamoProjectItem);
  }

  async findByTenantId(tenantId: TenantId, nextToken?: string): Promise<ProjectListResult> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': makePK(tenantId.value),
          ':skPrefix': 'PROJECT#',
        },
        ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
        Limit: 25,
      }),
    );

    const projects = (result.Items ?? []).map((item) =>
      this.toDomainEntity(item as DynamoProjectItem),
    );

    const newNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { projects, nextToken: newNextToken };
  }

  async delete(tenantId: TenantId, projectId: ProjectId): Promise<void> {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: makePK(tenantId.value),
          SK: makeSK(projectId.value),
        },
      }),
    );
  }

  async countByTenantId(tenantId: TenantId): Promise<number> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': makePK(tenantId.value),
          ':skPrefix': 'PROJECT#',
        },
        Select: 'COUNT',
      }),
    );

    return result.Count ?? 0;
  }

  private toDomainEntity(item: DynamoProjectItem): Project {
    return Project.reconstitute({
      projectId: ProjectId.create(item.projectId),
      tenantId: TenantId.create(item.tenantId),
      name: ProjectName.create(item.name),
      description: ProjectDescription.create(item.description),
      status: item.status,
      templateId: item.templateId,
      repoUrl: item.repoUrl,
      deployedUrl: item.deployedUrl,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }
}
