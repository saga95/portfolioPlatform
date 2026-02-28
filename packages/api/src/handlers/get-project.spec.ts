import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeGetProjectHandler } from './get-project.js';
import type { ProjectRepository } from '@promptdeploy/core';
import { Project, ProjectId, TenantId, ProjectName, ProjectDescription } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/projects/proj_abc123',
    headers: { 'x-tenant-id': 'tenant_abc123' },
    body: null,
    pathParameters: { projectId: 'proj_abc123' },
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

describe('GetProject Handler', () => {
  let mockRepo: ProjectRepository;

  const existingProject = Project.create({
    projectId: ProjectId.create('proj_abc123') as ProjectId,
    tenantId: TenantId.create('tenant_abc123') as TenantId,
    name: ProjectName.create('My App') as ProjectName,
    description: ProjectDescription.create('Desc') as ProjectDescription,
    templateId: 'tmpl-1',
  });

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(existingProject),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(0),
    };
  });

  it('should return 200 with project DTO', async () => {
    const handler = makeGetProjectHandler(mockRepo);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.projectId).toBe('proj_abc123');
    expect(body.name).toBe('My App');
  });

  it('should return 404 when project not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const handler = makeGetProjectHandler(mockRepo);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(404);

    const body = JSON.parse(res.body);
    expect(body.code).toBe('PROJECT_NOT_FOUND');
  });

  it('should return 400 for missing tenant header', async () => {
    const handler = makeGetProjectHandler(mockRepo);
    const response = await handler(makeEvent({ headers: {} }), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });
});
