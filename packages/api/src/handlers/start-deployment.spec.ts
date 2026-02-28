import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeStartDeploymentHandler } from './start-deployment.js';
import type { DeploymentRepository, ProjectRepository, IdGenerator } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/deployments',
    headers: {
      'x-tenant-id': 'tenant_abc123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: 'proj_test123',
      version: '0.1.0',
    }),
    pathParameters: null,
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

const mockProject = {
  id: { value: 'proj_test123' },
  tenantId: { value: 'tenant_abc123' },
  name: { value: 'Test Project' },
  status: 'draft',
};

describe('StartDeployment Handler', () => {
  let mockDeployRepo: DeploymentRepository;
  let mockProjectRepo: ProjectRepository;
  let mockIdGen: IdGenerator;

  beforeEach(() => {
    mockDeployRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue({ deployments: [], nextToken: undefined }),
      findActiveByProjectId: vi.fn().mockResolvedValue(null),
    };
    mockProjectRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockProject),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(1),
    };
    mockIdGen = {
      generate: vi.fn().mockReturnValue('deploy_generated123'),
    };
  });

  it('should return 201 with deployment DTO on success', async () => {
    const handler = makeStartDeploymentHandler(mockDeployRepo, mockProjectRepo, mockIdGen);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(201);

    const body = JSON.parse(res.body);
    expect(body.deploymentId).toBe('deploy_generated123');
    expect(body.projectId).toBe('proj_test123');
    expect(body.status).toBe('pending');
    expect(body.version).toBe('0.1.0');
  });

  it('should return 400 when x-tenant-id header is missing', async () => {
    const handler = makeStartDeploymentHandler(mockDeployRepo, mockProjectRepo, mockIdGen);
    const response = await handler(
      makeEvent({ headers: { 'Content-Type': 'application/json' } }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when body is missing version', async () => {
    const handler = makeStartDeploymentHandler(mockDeployRepo, mockProjectRepo, mockIdGen);
    const response = await handler(
      makeEvent({ body: JSON.stringify({ projectId: 'proj_test123' }) }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when project does not exist', async () => {
    vi.mocked(mockProjectRepo.findById).mockResolvedValue(null);

    const handler = makeStartDeploymentHandler(mockDeployRepo, mockProjectRepo, mockIdGen);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(404);
  });
});
