import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCreateProjectHandler } from './create-project.js';
import type { ProjectRepository, IdGenerator } from '@promptdeploy/core';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/projects',
    headers: {
      'x-tenant-id': 'tenant_abc123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'My Project',
      description: 'A test project',
      templateId: 'tmpl-react',
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

describe('CreateProject Handler', () => {
  let mockRepo: ProjectRepository;
  let mockIdGen: IdGenerator;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByTenantId: vi.fn().mockResolvedValue({ projects: [], nextToken: undefined }),
      delete: vi.fn().mockResolvedValue(undefined),
      countByTenantId: vi.fn().mockResolvedValue(0),
    };
    mockIdGen = {
      generate: vi.fn().mockReturnValue('proj_generated123'),
    };
  });

  it('should return 201 with project DTO on success', async () => {
    const handler = makeCreateProjectHandler(mockRepo, mockIdGen);
    const response = await handler(makeEvent(), mockContext, callback);

    expect(response).toBeDefined();
    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(201);

    const body = JSON.parse(res.body);
    expect(body.projectId).toBe('proj_generated123');
    expect(body.name).toBe('My Project');
    expect(body.status).toBe('draft');
  });

  it('should return 400 when x-tenant-id header is missing', async () => {
    const handler = makeCreateProjectHandler(mockRepo, mockIdGen);
    const response = await handler(
      makeEvent({ headers: { 'Content-Type': 'application/json' } }),
      mockContext,
      callback,
    );

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);

    const body = JSON.parse(res.body);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when body is invalid (missing name)', async () => {
    const handler = makeCreateProjectHandler(mockRepo, mockIdGen);
    const event = makeEvent({
      body: JSON.stringify({ description: 'No name', templateId: 'tmpl' }),
    });
    const response = await handler(event, mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(400);
  });

  it('should return 403 when project limit exceeded', async () => {
    vi.mocked(mockRepo.countByTenantId).mockResolvedValue(5);

    const handler = makeCreateProjectHandler(mockRepo, mockIdGen, 5);
    const response = await handler(makeEvent(), mockContext, callback);

    const res = response as { statusCode: number; body: string };
    expect(res.statusCode).toBe(403);

    const body = JSON.parse(res.body);
    expect(body.code).toBe('PROJECT_LIMIT_EXCEEDED');
  });
});
