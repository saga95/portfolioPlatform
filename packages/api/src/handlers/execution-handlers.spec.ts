import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeGetExecutionHandler } from './get-execution.js';
import { makeUpdateExecutionHandler } from './update-execution.js';
import { makeListExecutionsHandler } from './list-executions.js';
import type { ExecutionRepository } from '@promptdeploy/core';
import { AgentExecution, ExecutionId, ProjectId, TenantId } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockContext = {} as Context;
const callback = vi.fn();

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/executions/exec_test123',
    headers: {
      'x-tenant-id': 'tenant_abc123',
      'Content-Type': 'application/json',
    },
    body: null,
    pathParameters: { executionId: 'exec_test123' },
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

function createMockExecution() {
  return AgentExecution.create({
    executionId: ExecutionId.create('exec_test123') as ExecutionId,
    projectId: ProjectId.create('proj_test456') as ProjectId,
    tenantId: TenantId.create('tenant_abc123') as TenantId,
    tokensBudget: 100_000,
  });
}

describe('GetExecution Handler', () => {
  let mockRepo: ExecutionRepository;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(createMockExecution()),
      findByProjectId: vi.fn().mockResolvedValue({ executions: [], nextToken: undefined }),
      findRunningByProjectId: vi.fn().mockResolvedValue(null),
    };
  });

  it('should return 200 with execution DTO', async () => {
    const handler = makeGetExecutionHandler(mockRepo);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.executionId).toBe('exec_test123');
    expect(body.status).toBe('running');
    expect(body.progressPercent).toBeDefined();
  });

  it('should return 404 when execution not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const handler = makeGetExecutionHandler(mockRepo);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 when executionId is missing from path', async () => {
    const handler = makeGetExecutionHandler(mockRepo);
    const response = await handler(
      makeEvent({ pathParameters: null }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });
});

describe('UpdateExecution Handler', () => {
  let mockRepo: ExecutionRepository;

  beforeEach(() => {
    // Create an execution in 'waiting_for_human' state so actions work
    const exec = createMockExecution().waitForHuman();
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(exec),
      findByProjectId: vi.fn().mockResolvedValue({ executions: [], nextToken: undefined }),
      findRunningByProjectId: vi.fn().mockResolvedValue(null),
    };
  });

  it('should return 200 after applying approve action', async () => {
    const handler = makeUpdateExecutionHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ action: 'approve' }),
        pathParameters: { executionId: 'exec_test123' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.status).toBe('running');
  });

  it('should return 200 after applying cancel action', async () => {
    const handler = makeUpdateExecutionHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ action: 'cancel' }),
        pathParameters: { executionId: 'exec_test123' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.status).toBe('cancelled');
  });

  it('should return 400 when action is invalid', async () => {
    const handler = makeUpdateExecutionHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ action: 'invalid' }),
        pathParameters: { executionId: 'exec_test123' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 404 when execution not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    const handler = makeUpdateExecutionHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'PATCH',
        body: JSON.stringify({ action: 'cancel' }),
        pathParameters: { executionId: 'exec_test123' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(404);
  });
});

describe('ListExecutions Handler', () => {
  let mockRepo: ExecutionRepository;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue({
        executions: [createMockExecution()],
        nextToken: undefined,
      }),
      findRunningByProjectId: vi.fn().mockResolvedValue(null),
    };
  });

  it('should return 200 with execution list', async () => {
    const handler = makeListExecutionsHandler(mockRepo);
    const response = await handler(
      makeEvent({
        httpMethod: 'GET',
        path: '/projects/proj_test456/executions',
        pathParameters: { projectId: 'proj_test456' },
      }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.body);
    expect(body.executions).toHaveLength(1);
    expect(body.executions[0].executionId).toBe('exec_test123');
  });

  it('should return 400 when projectId is missing from path', async () => {
    const handler = makeListExecutionsHandler(mockRepo);
    const response = await handler(
      makeEvent({ pathParameters: null }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });
});
