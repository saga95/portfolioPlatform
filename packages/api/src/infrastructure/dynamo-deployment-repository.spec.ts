import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamoDeploymentRepository } from './dynamo-deployment-repository.js';
import {
  Deployment,
  DeploymentId,
  ProjectId,
  TenantId,
} from '@promptdeploy/core';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const mockSend = vi.fn();
const mockDocClient = { send: mockSend } as unknown as DynamoDBDocumentClient;

describe('DynamoDeploymentRepository', () => {
  let repo: DynamoDeploymentRepository;
  const tableName = 'test-deployments';

  const tenantId = TenantId.create('tenant_abc123') as TenantId;
  const projectId = ProjectId.create('proj_abc123') as ProjectId;
  const deploymentId = DeploymentId.create('deploy_abc123') as DeploymentId;

  const testDeployment = Deployment.create({
    deploymentId,
    projectId,
    tenantId,
    version: '0.1.0',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoDeploymentRepository(mockDocClient, tableName);
  });

  describe('save', () => {
    it('should put item with correct key schema', async () => {
      mockSend.mockResolvedValue({});

      await repo.save(testDeployment);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const putInput = mockSend.mock.calls[0][0].input;
      expect(putInput.TableName).toBe(tableName);
      expect(putInput.Item.PK).toBe('TENANT#tenant_abc123');
      expect(putInput.Item.SK).toBe('DEPLOYMENT#deploy_abc123');
      expect(putInput.Item.GSI1PK).toBe('TENANT#tenant_abc123#PROJECT#proj_abc123');
      expect(putInput.Item.GSI1SK).toContain('DEPLOYMENT#pending#');
      expect(putInput.Item.entityType).toBe('DEPLOYMENT');
      expect(putInput.Item.status).toBe('pending');
      expect(putInput.Item.version).toBe('0.1.0');
      expect(putInput.Item.logs).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('should return Deployment when found', async () => {
      mockSend.mockResolvedValue({
        Item: {
          PK: 'TENANT#tenant_abc123',
          SK: 'DEPLOYMENT#deploy_abc123',
          deploymentId: 'deploy_abc123',
          tenantId: 'tenant_abc123',
          projectId: 'proj_abc123',
          version: '0.1.0',
          status: 'pending',
          logs: [],
          startedAt: testDeployment.startedAt,
        },
      });

      const result = await repo.findById(tenantId, deploymentId);

      expect(result).not.toBeNull();
      expect(result!.deploymentId.value).toBe('deploy_abc123');
      expect(result!.status).toBe('pending');
      expect(result!.version).toBe('0.1.0');
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await repo.findById(tenantId, deploymentId);

      expect(result).toBeNull();
    });
  });

  describe('findByProjectId', () => {
    it('should return list of deployments', async () => {
      mockSend.mockResolvedValue({
        Items: [
          {
            deploymentId: 'deploy_111',
            tenantId: 'tenant_abc123',
            projectId: 'proj_abc123',
            version: '0.2.0',
            status: 'succeeded',
            logs: ['[2025-01-01T00:00:00.000Z] Deployed'],
            startedAt: '2025-01-01T00:00:00.000Z',
            completedAt: '2025-01-01T00:05:00.000Z',
            deployedUrl: 'https://app.example.com',
          },
        ],
        LastEvaluatedKey: undefined,
      });

      const result = await repo.findByProjectId(tenantId, projectId);

      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].deploymentId.value).toBe('deploy_111');
      expect(result.deployments[0].deployedUrl).toBe('https://app.example.com');
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
      expect(queryInput.ExpressionAttributeValues[':skPrefix']).toBe('DEPLOYMENT#');
    });
  });

  describe('findActiveByProjectId', () => {
    it('should return null when no active deployment', async () => {
      mockSend.mockResolvedValue({ Items: [] });

      const result = await repo.findActiveByProjectId(tenantId, projectId);

      expect(result).toBeNull();
    });

    it('should return active deployment when found', async () => {
      // First status query (pending) returns a result
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            deploymentId: 'deploy_active',
            tenantId: 'tenant_abc123',
            projectId: 'proj_abc123',
            version: '0.3.0',
            status: 'pending',
            logs: [],
            startedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      });

      const result = await repo.findActiveByProjectId(tenantId, projectId);

      expect(result).not.toBeNull();
      expect(result!.deploymentId.value).toBe('deploy_active');
      expect(result!.status).toBe('pending');
    });

    it('should check multiple active statuses', async () => {
      // pending: no results
      mockSend.mockResolvedValueOnce({ Items: [] });
      // bootstrapping: no results
      mockSend.mockResolvedValueOnce({ Items: [] });
      // deploying: found
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            deploymentId: 'deploy_deploying',
            tenantId: 'tenant_abc123',
            projectId: 'proj_abc123',
            version: '0.4.0',
            status: 'deploying',
            logs: [],
            startedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      });

      const result = await repo.findActiveByProjectId(tenantId, projectId);

      expect(result).not.toBeNull();
      expect(result!.status).toBe('deploying');
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });
});
