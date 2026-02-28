import type { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * Decoded Cognito JWT claims available in the API Gateway request context.
 * When a Cognito authorizer is attached, the claims are injected automatically.
 */
export interface CognitoClaims {
  sub: string;
  email: string;
  email_verified: string;
  'custom:tenantId': string;
  'custom:plan': string;
  name?: string;
}

/**
 * Extracted tenant context from an authenticated request.
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  email: string;
  plan: string;
  name?: string;
}

/**
 * Extract tenant context from Cognito JWT claims or x-tenant-id header.
 *
 * Order of precedence:
 * 1. Cognito authorizer claims (production)
 * 2. x-tenant-id header (development / testing)
 *
 * @throws Error if no tenant context can be determined
 */
export function extractTenantContext(event: APIGatewayProxyEvent): TenantContext {
  // 1. Try Cognito authorizer claims
  const claims = event.requestContext.authorizer?.claims as CognitoClaims | undefined;
  if (claims?.['custom:tenantId']) {
    return {
      tenantId: claims['custom:tenantId'],
      userId: claims.sub,
      email: claims.email,
      plan: claims['custom:plan'] ?? 'free',
      name: claims.name,
    };
  }

  // 2. Fallback to x-tenant-id header (dev/test only)
  const headerTenantId =
    event.headers['x-tenant-id'] ?? event.headers['X-Tenant-Id'];
  if (headerTenantId) {
    return {
      tenantId: headerTenantId,
      userId: 'dev-user',
      email: 'dev@promptdeploy.com',
      plan: 'pro',
    };
  }

  throw new Error('Unauthorized: missing tenant context');
}
