import type { APIGatewayProxyResult } from 'aws-lambda';
import type { DomainError } from '@promptdeploy/core';

/**
 * Map domain error codes to HTTP status codes.
 */
const ERROR_STATUS_MAP: Record<string, number> = {
  PROJECT_NOT_FOUND: 404,
  PROJECT_ALREADY_EXISTS: 409,
  PROJECT_LIMIT_EXCEEDED: 403,
  INVALID_PROJECT_TRANSITION: 422,
  UNAUTHORIZED: 401,
  INSUFFICIENT_ENTITLEMENT: 403,
  VALIDATION_ERROR: 400,
  EXECUTION_NOT_FOUND: 404,
  INVALID_EXECUTION_TRANSITION: 422,
  TOKEN_BUDGET_EXCEEDED: 429,
  EXECUTION_ALREADY_RUNNING: 409,
  DEPLOYMENT_NOT_FOUND: 404,
  INVALID_DEPLOYMENT_TRANSITION: 422,
};

/**
 * Build a successful API Gateway response.
 */
export function success(body: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Build an error API Gateway response from a domain error.
 */
export function domainErrorResponse(error: DomainError): APIGatewayProxyResult {
  const statusCode = ERROR_STATUS_MAP[error.code] ?? 500;
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: error.code,
      message: error.message,
    }),
  };
}

/**
 * Build a validation error response.
 */
export function validationError(message: string, details?: unknown): APIGatewayProxyResult {
  return {
    statusCode: 400,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'VALIDATION_ERROR',
      message,
      details,
    }),
  };
}
