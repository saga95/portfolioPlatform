import type {
  ExecutionRepository,
  ExecutionListResult,
} from '@promptdeploy/core';
import {
  AgentExecution,
  ExecutionId,
  TenantId,
  ProjectId,
  PIPELINE_STEPS,
} from '@promptdeploy/core';
import type { AgentExecutionStatus } from '@promptdeploy/shared-types';
import type { PipelineStep, StepRecord } from '@promptdeploy/core';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB key schema utilities for executions (single-table design).
 *
 * PK:   TENANT#<tenantId>
 * SK:   EXECUTION#<executionId>
 * GSI1PK: TENANT#<tenantId>#PROJECT#<projectId>
 * GSI1SK: EXECUTION#<status>#<startedAt>
 */
function makePK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}
function makeSK(executionId: string): string {
  return `EXECUTION#${executionId}`;
}
function makeGSI1PK(tenantId: string, projectId: string): string {
  return `TENANT#${tenantId}#PROJECT#${projectId}`;
}
function makeGSI1SK(status: string, startedAt: string): string {
  return `EXECUTION#${status}#${startedAt}`;
}

interface DynamoExecutionItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: 'EXECUTION';
  executionId: string;
  tenantId: string;
  projectId: string;
  status: AgentExecutionStatus;
  currentStep: PipelineStep;
  tokensUsed: number;
  tokensBudget: number;
  steps: StepRecord[];
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

/**
 * DynamoDB implementation of the ExecutionRepository port.
 * Maps between domain AgentExecution entities and DynamoDB items.
 */
export class DynamoExecutionRepository implements ExecutionRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async save(execution: AgentExecution): Promise<void> {
    const item: DynamoExecutionItem = {
      PK: makePK(execution.tenantId.value),
      SK: makeSK(execution.executionId.value),
      GSI1PK: makeGSI1PK(execution.tenantId.value, execution.projectId.value),
      GSI1SK: makeGSI1SK(execution.status, execution.startedAt),
      entityType: 'EXECUTION',
      executionId: execution.executionId.value,
      tenantId: execution.tenantId.value,
      projectId: execution.projectId.value,
      status: execution.status,
      currentStep: execution.currentStep,
      tokensUsed: execution.tokensUsed,
      tokensBudget: execution.tokensBudget,
      steps: [...execution.steps] as StepRecord[],
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      errorMessage: execution.errorMessage,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async findById(tenantId: TenantId, executionId: ExecutionId): Promise<AgentExecution | null> {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: makePK(tenantId.value),
          SK: makeSK(executionId.value),
        },
      }),
    );

    if (!result.Item) return null;

    return this.toDomainEntity(result.Item as DynamoExecutionItem);
  }

  async findByProjectId(
    tenantId: TenantId,
    projectId: ProjectId,
    nextToken?: string,
  ): Promise<ExecutionListResult> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': makeGSI1PK(tenantId.value, projectId.value),
          ':skPrefix': 'EXECUTION#',
        },
        ExclusiveStartKey: nextToken
          ? JSON.parse(Buffer.from(nextToken, 'base64').toString())
          : undefined,
        ScanIndexForward: false, // Newest first
        Limit: 25,
      }),
    );

    const executions = (result.Items ?? []).map((item) =>
      this.toDomainEntity(item as DynamoExecutionItem),
    );

    const newNextToken = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
      : undefined;

    return { executions, nextToken: newNextToken };
  }

  async findRunningByProjectId(
    tenantId: TenantId,
    projectId: ProjectId,
  ): Promise<AgentExecution | null> {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :statusPrefix)',
        ExpressionAttributeValues: {
          ':gsi1pk': makeGSI1PK(tenantId.value, projectId.value),
          ':statusPrefix': 'EXECUTION#running#',
        },
        Limit: 1,
      }),
    );

    if (!result.Items?.length) return null;

    return this.toDomainEntity(result.Items[0] as DynamoExecutionItem);
  }

  private toDomainEntity(item: DynamoExecutionItem): AgentExecution {
    return AgentExecution.reconstitute({
      executionId: ExecutionId.create(item.executionId) as ExecutionId,
      projectId: ProjectId.create(item.projectId) as ProjectId,
      tenantId: TenantId.create(item.tenantId) as TenantId,
      status: item.status,
      currentStep: item.currentStep,
      tokensUsed: item.tokensUsed,
      tokensBudget: item.tokensBudget,
      steps: item.steps,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      errorMessage: item.errorMessage,
    });
  }
}
