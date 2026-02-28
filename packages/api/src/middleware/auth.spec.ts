import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { extractTenantContext } from './auth';

function makeEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/projects',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/projects',
    requestContext: {
      accountId: '123456789012',
      apiId: 'api123',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {} as never,
      path: '/projects',
      stage: 'dev',
      requestId: 'req-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'res-123',
      resourcePath: '/projects',
    },
    ...overrides,
  };
}

describe('extractTenantContext', () => {
  it('should extract context from Cognito authorizer claims', () => {
    const event = makeEvent({
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: {
          claims: {
            sub: 'user-uuid-123',
            email: 'alice@example.com',
            email_verified: 'true',
            'custom:tenantId': 'tenant_abc',
            'custom:plan': 'pro',
            name: 'Alice',
          },
        },
      },
    });

    const ctx = extractTenantContext(event);

    expect(ctx.tenantId).toBe('tenant_abc');
    expect(ctx.userId).toBe('user-uuid-123');
    expect(ctx.email).toBe('alice@example.com');
    expect(ctx.plan).toBe('pro');
    expect(ctx.name).toBe('Alice');
  });

  it('should default plan to free when missing from claims', () => {
    const event = makeEvent({
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: {
          claims: {
            sub: 'user-uuid-456',
            email: 'bob@example.com',
            email_verified: 'true',
            'custom:tenantId': 'tenant_xyz',
          },
        },
      },
    });

    const ctx = extractTenantContext(event);
    expect(ctx.plan).toBe('free');
  });

  it('should fall back to x-tenant-id header when no Cognito claims', () => {
    const event = makeEvent({
      headers: { 'x-tenant-id': 'tenant_header123' },
    });

    const ctx = extractTenantContext(event);

    expect(ctx.tenantId).toBe('tenant_header123');
    expect(ctx.userId).toBe('dev-user');
    expect(ctx.email).toBe('dev@promptdeploy.com');
    expect(ctx.plan).toBe('pro');
  });

  it('should support X-Tenant-Id (capitalized) header', () => {
    const event = makeEvent({
      headers: { 'X-Tenant-Id': 'tenant_Caps' },
    });

    const ctx = extractTenantContext(event);
    expect(ctx.tenantId).toBe('tenant_Caps');
  });

  it('should throw when no tenant context is available', () => {
    const event = makeEvent();

    expect(() => extractTenantContext(event)).toThrow('Unauthorized: missing tenant context');
  });

  it('should prefer Cognito claims over header', () => {
    const event = makeEvent({
      headers: { 'x-tenant-id': 'header-tenant' },
      requestContext: {
        ...makeEvent().requestContext,
        authorizer: {
          claims: {
            sub: 'user-uuid-789',
            email: 'charlie@example.com',
            email_verified: 'true',
            'custom:tenantId': 'cognito-tenant',
            'custom:plan': 'team',
          },
        },
      },
    });

    const ctx = extractTenantContext(event);
    expect(ctx.tenantId).toBe('cognito-tenant');
  });
});
