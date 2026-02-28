import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeStartExecutionHandler } from './start-execution.js';
import type { ExecutionRepository, ProjectRepository, IdGenerator } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/executions',
    headers: {
      'x-tenant-id': 'tenant_abc123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: 'proj_test123',
    }),
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: {
      authorizer: { claims: { 'custom:plan': 'pro' } },
    } as unknown as APIGatewayProxyEvent['requestContext'],
    resource: '',
    ...overrides,
  } as APIGatewayProxyEvent;
}

const mockContext = {} as Context;
const callback = vi.fn();

// Minimal project-like object
const mockProject = {
  id: { value: 'proj_test123' },
  tenantId: { value: 'tenant_abc123' },
  name: { value: 'Test Project' },
  status: 'draft',
};

describe('StartExecution Handler', () => {
  let mockExecRepo: ExecutionRepository;
  let mockProjectRepo: ProjectRepository;
  let mockIdGen: IdGenerator;

  beforeEach(() => {
    mockExecRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue({ executions: [], nextToken: undefined }),
      findRunningByProjectId: vi.fn().mockResolvedValue(null),
    };
    mockProjectRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockProject),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(1),
    };
    mockIdGen = {
      generate: vi.fn().mockReturnValue('exec_generated123'),
    };
  });

  it('should return 201 with execution DTO on success', async () => {
    const handler = makeStartExecutionHandler(mockExecRepo, mockProjectRepo, mockIdGen);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(201);

    const body = JSON.parse(res.body);
    expect(body.executionId).toBe('exec_generated123');
    expect(body.projectId).toBe('proj_test123');
    expect(body.status).toBe('running');
    expect(body.currentStep).toBe('requirement_analysis');
  });

  it('should return 400 when x-tenant-id header is missing', async () => {
    const handler = makeStartExecutionHandler(mockExecRepo, mockProjectRepo, mockIdGen);
    const response = await handler(
      makeEvent({ headers: { 'Content-Type': 'application/json' } }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when body is missing projectId', async () => {
    const handler = makeStartExecutionHandler(mockExecRepo, mockProjectRepo, mockIdGen);
    const response = await handler(
      makeEvent({ body: JSON.stringify({}) }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when project does not exist', async () => {
    vi.mocked(mockProjectRepo.findById).mockResolvedValue(null);

    const handler = makeStartExecutionHandler(mockExecRepo, mockProjectRepo, mockIdGen);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(404);
  });

  it('should return 409 when execution already running', async () => {
    vi.mocked(mockExecRepo.findRunningByProjectId).mockResolvedValue({} as never);

    const handler = makeStartExecutionHandler(mockExecRepo, mockProjectRepo, mockIdGen);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(409);
  });
});
