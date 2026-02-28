import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamoExecutionRepository } from './dynamo-execution-repository.js';
import {
  AgentExecution,
  ExecutionId,
  ProjectId,
  TenantId,
} from '@promptdeploy/core';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock the DynamoDB Document Client
const mockSend = vi.fn();
const mockDocClient = { send: mockSend } as unknown as DynamoDBDocumentClient;

describe('DynamoExecutionRepository', () => {
  let repo: DynamoExecutionRepository;
  const tableName = 'test-executions';

  const tenantId = TenantId.create('tenant_abc123') as TenantId;
  const projectId = ProjectId.create('proj_abc123') as ProjectId;
  const executionId = ExecutionId.create('exec_abc123') as ExecutionId;

  const testExecution = AgentExecution.create({
    executionId,
    projectId,
    tenantId,
    tokensBudget: 100_000,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoExecutionRepository(mockDocClient, tableName);
  });

  describe('save', () => {
    it('should put item with correct key schema', async () => {
      mockSend.mockResolvedValue({});

      await repo.save(testExecution);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const putInput = mockSend.mock.calls[0][0].input;
      expect(putInput.TableName).toBe(tableName);
      expect(putInput.Item.PK).toBe('TENANT#tenant_abc123');
      expect(putInput.Item.SK).toBe('EXECUTION#exec_abc123');
      expect(putInput.Item.GSI1PK).toBe('TENANT#tenant_abc123#PROJECT#proj_abc123');
      expect(putInput.Item.GSI1SK).toContain('EXECUTION#running#');
      expect(putInput.Item.entityType).toBe('EXECUTION');
      expect(putInput.Item.status).toBe('running');
      expect(putInput.Item.currentStep).toBe('requirement_analysis');
      expect(putInput.Item.tokensBudget).toBe(100_000);
      expect(putInput.Item.steps).toHaveLength(10);
    });
  });

  describe('findById', () => {
    it('should return AgentExecution when found', async () => {
      mockSend.mockResolvedValue({
        Item: {
          PK: 'TENANT#tenant_abc123',
          SK: 'EXECUTION#exec_abc123',
          executionId: 'exec_abc123',
          tenantId: 'tenant_abc123',
          projectId: 'proj_abc123',
          status: 'running',
          currentStep: 'requirement_analysis',
          tokensUsed: 0,
          tokensBudget: 100_000,
          steps: testExecution.steps,
          startedAt: testExecution.startedAt,
        },
      });

      const result = await repo.findById(tenantId, executionId);

      expect(result).not.toBeNull();
      expect(result!.executionId.value).toBe('exec_abc123');
      expect(result!.status).toBe('running');
      expect(result!.currentStep).toBe('requirement_analysis');
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await repo.findById(tenantId, executionId);

      expect(result).toBeNull();
    });
  });

  describe('findByProjectId', () => {
    it('should return list of executions', async () => {
      mockSend.mockResolvedValue({
        Items: [
          {
            executionId: 'exec_111',
            tenantId: 'tenant_abc123',
            projectId: 'proj_abc123',
            status: 'running',
            currentStep: 'requirement_analysis',
            tokensUsed: 0,
            tokensBudget: 100_000,
            steps: testExecution.steps,
            startedAt: testExecution.startedAt,
          },
        ],
        LastEvaluatedKey: undefined,
      });

      const result = await repo.findByProjectId(tenantId, projectId);

      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].executionId.value).toBe('exec_111');
      expect(result.nextToken).toBeUndefined();
    });

    it('should return nextToken when more items exist', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: { PK: 'x', SK: 'y', GSI1PK: 'a', GSI1SK: 'b' },
      });

      const result = await repo.findByProjectId(tenantId, projectId);

      expect(result.nextToken).toBeDefined();
      expect(typeof result.nextToken).toBe('string');
    });

    it('should use GSI1 index with correct key condition', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await repo.findByProjectId(tenantId, projectId);

      const queryInput = mockSend.mock.calls[0][0].input;
      expect(queryInput.IndexName).toBe('GSI1');
      expect(queryInput.KeyConditionExpression).toContain('GSI1PK');
      expect(queryInput.ExpressionAttributeValues[':gsi1pk']).toBe(
        'TENANT#tenant_abc123#PROJECT#proj_abc123',
      );
    });
  });

  describe('findRunningByProjectId', () => {
    it('should return running execution when found', async () => {
      mockSend.mockResolvedValue({
        Items: [
          {
            executionId: 'exec_run1',
            tenantId: 'tenant_abc123',
            projectId: 'proj_abc123',
            status: 'running',
            currentStep: 'system_design',
            tokensUsed: 5000,
            tokensBudget: 100_000,
            steps: testExecution.steps,
            startedAt: testExecution.startedAt,
          },
        ],
      });

      const result = await repo.findRunningByProjectId(tenantId, projectId);

      expect(result).not.toBeNull();
      expect(result!.executionId.value).toBe('exec_run1');
    });

    it('should return null when no running execution exists', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await repo.findRunningByProjectId(tenantId, projectId);

      expect(result).toBeNull();
    });

    it('should query GSI1 with running status prefix', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      await repo.findRunningByProjectId(tenantId, projectId);

      const queryInput = mockSend.mock.calls[0][0].input;
      expect(queryInput.IndexName).toBe('GSI1');
      expect(queryInput.ExpressionAttributeValues[':statusPrefix']).toBe(
        'EXECUTION#running#',
      );
    });
  });
});
