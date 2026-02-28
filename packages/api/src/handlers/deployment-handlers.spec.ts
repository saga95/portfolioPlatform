import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeGetDeploymentHandler } from './get-deployment.js';
import { makeUpdateDeploymentHandler } from './update-deployment.js';
import { makeListDeploymentsHandler } from './list-deployments.js';
import type { DeploymentRepository } from '@promptdeploy/core';
import { Deployment, DeploymentId, ProjectId, TenantId } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockContext = {} as Context;
const callback = vi.fn();

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/deployments/deploy_test123',
    headers: {
      'x-tenant-id': 'tenant_abc123',
      'Content-Type': 'application/json',
    },
    body: null,
    pathParameters: { deploymentId: 'deploy_test123' },
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

function createMockDeployment() {
  return Deployment.create({
    deploymentId: DeploymentId.create('deploy_test123') as DeploymentId,
    projectId: ProjectId.create('proj_test456') as ProjectId,
    tenantId: TenantId.create('tenant_abc123') as TenantId,
    version: '0.1.0',
  });
}

describe('GetDeployment Handler', () => {
  let mockRepo: DeploymentRepository;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(createMockDeployment()),
      findByProjectId: vi.fn().mockResolvedValue({ deployments: [], nextToken: undefined }),
      findActiveByProjectId: vi.fn().mockResolvedValue(null),
    };
  });

  it('should return 200 with deployment DTO', async () => {
    const handler = makeGetDeploymentHandler(mockRepo);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.deploymentId).toBe('deploy_test123');
    expect(body.status).toBe('pending');
    expect(body.version).toBe('0.1.0');
  });

  it('should return 404 when deployment not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const handler = makeGetDeploymentHandler(mockRepo);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 when deploymentId is missing from path', async () => {
    const handler = makeGetDeploymentHandler(mockRepo);
    const response = await handler(
      makeEvent({ pathParameters: null }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });
});

describe('UpdateDeployment Handler', () => {
  let mockRepo: DeploymentRepository;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(createMockDeployment()),
      findByProjectId: vi.fn().mockResolvedValue({ deployments: [], nextToken: undefined }),
      findActiveByProjectId: vi.fn().mockResolvedValue(null),
    };
  });

  it('should return 200 after applying start_bootstrap action', async () => {
    const handler = makeUpdateDeploymentHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ action: 'start_bootstrap' }),
        pathParameters: { deploymentId: 'deploy_test123' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.status).toBe('bootstrapping');
  });

  it('should return 422 on invalid transition', async () => {
    const handler = makeUpdateDeploymentHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ action: 'mark_succeeded', deployedUrl: 'https://app.test.com' }),
        pathParameters: { deploymentId: 'deploy_test123' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(422);
  });

  it('should return 400 when action is invalid', async () => {
    const handler = makeUpdateDeploymentHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ action: 'bogus' }),
        pathParameters: { deploymentId: 'deploy_test123' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when deployment not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const handler = makeUpdateDeploymentHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ action: 'start_bootstrap' }),
        pathParameters: { deploymentId: 'deploy_test123' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(404);
  });
});

describe('ListDeployments Handler', () => {
  let mockRepo: DeploymentRepository;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue({
        deployments: [createMockDeployment()],
        nextToken: undefined,
      }),
      findActiveByProjectId: vi.fn().mockResolvedValue(null),
    };
  });

  it('should return 200 with deployment list', async () => {
    const handler = makeListDeploymentsHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        path: '/projects/proj_test456/deployments',
        pathParameters: { projectId: 'proj_test456' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.deployments).toHaveLength(1);
    expect(body.deployments[0].deploymentId).toBe('deploy_test123');
  });

  it('should return 400 when projectId is missing from path', async () => {
    const handler = makeListDeploymentsHandler(mockRepo);
    const response = await handler(
      makeEvent({ pathParameters: null }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });
});
