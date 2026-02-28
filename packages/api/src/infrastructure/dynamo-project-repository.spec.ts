import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamoProjectRepository } from './dynamo-project-repository.js';
import {
  Project,
  ProjectId,
  TenantId,
  ProjectName,
  ProjectDescription,
} from '@promptdeploy/core';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Mock the DynamoDB Document Client
const mockSend = vi.fn();
const mockDocClient = { send: mockSend } as unknown as DynamoDBDocumentClient;

describe('DynamoProjectRepository', () => {
  let repo: DynamoProjectRepository;
  const tableName = 'test-projects';

  const tenantId = TenantId.create('tenant_abc123') as TenantId;
  const projectId = ProjectId.create('proj_abc123') as ProjectId;

  const testProject = Project.create({
    projectId,
    tenantId,
    name: ProjectName.create('Test Project') as ProjectName,
    description: ProjectDescription.create('A test') as ProjectDescription,
    templateId: 'tmpl-1',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DynamoProjectRepository(mockDocClient, tableName);
  });

  describe('save', () => {
    it('should put item with correct key schema', async () => {
      mockSend.mockResolvedValue({});

      await repo.save(testProject);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const putInput = mockSend.mock.calls[0][0].input;
      expect(putInput.TableName).toBe(tableName);
      expect(putInput.Item.PK).toBe('TENANT#tenant_abc123');
      expect(putInput.Item.SK).toBe('PROJECT#proj_abc123');
      expect(putInput.Item.GSI1PK).toBe('TENANT#tenant_abc123');
      expect(putInput.Item.GSI1SK).toContain('STATUS#draft#');
      expect(putInput.Item.entityType).toBe('PROJECT');
      expect(putInput.Item.name).toBe('Test Project');
    });
  });

  describe('findById', () => {
    it('should return Project entity when found', async () => {
      mockSend.mockResolvedValue({
        Item: {
          PK: 'TENANT#tenant_abc123',
          SK: 'PROJECT#proj_abc123',
          projectId: 'proj_abc123',
          tenantId: 'tenant_abc123',
          name: 'Test Project',
          description: 'A test',
          status: 'draft',
          templateId: 'tmpl-1',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const result = await repo.findById(tenantId, projectId);

      expect(result).not.toBeNull();
      expect(result!.projectId.value).toBe('proj_abc123');
      expect(result!.name.value).toBe('Test Project');
      expect(result!.status).toBe('draft');
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await repo.findById(tenantId, projectId);

      expect(result).toBeNull();
    });
  });

  describe('findByTenantId', () => {
    it('should return list of projects', async () => {
      mockSend.mockResolvedValue({
        Items: [
          {
            projectId: 'proj_111',
            tenantId: 'tenant_abc123',
            name: 'Project 1',
            description: '',
            status: 'draft',
            templateId: 'tmpl-1',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        LastEvaluatedKey: undefined,
      });

      const result = await repo.findByTenantId(tenantId);

      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].projectId.value).toBe('proj_111');
      expect(result.nextToken).toBeUndefined();
    });

    it('should return nextToken when more items exist', async () => {
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: { PK: 'TENANT#tenant_abc123', SK: 'PROJECT#proj_999' },
      });

      const result = await repo.findByTenantId(tenantId);

      expect(result.nextToken).toBeDefined();
      expect(typeof result.nextToken).toBe('string');
    });
  });

  describe('countByTenantId', () => {
    it('should return count', async () => {
      mockSend.mockResolvedValue({ Count: 3 });

      const count = await repo.countByTenantId(tenantId);

      expect(count).toBe(3);
    });

    it('should return 0 when no items', async () => {
      mockSend.mockResolvedValue({ Count: 0 });

      const count = await repo.countByTenantId(tenantId);

      expect(count).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete with correct key', async () => {
      mockSend.mockResolvedValue({});

      await repo.delete(tenantId, projectId);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const deleteInput = mockSend.mock.calls[0][0].input;
      expect(deleteInput.Key.PK).toBe('TENANT#tenant_abc123');
      expect(deleteInput.Key.SK).toBe('PROJECT#proj_abc123');
    });
  });
});
