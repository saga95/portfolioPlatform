/**
 * Lambda entry point for the Execution API.
 *
 * This file wires together:
 * - DynamoDB client → DynamoExecutionRepository + DynamoProjectRepository adapters
 * - UUID-based IdGenerator (with prefix)
 * - All execution handler factory functions
 *
 * API Gateway routes all /executions/* and /projects/{projectId}/executions requests
 * to this single Lambda. The handler dispatches based on HTTP method + resource path.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { IdGenerator } from '../../../../core/src/domain/ports/id-generator.js';
import { DynamoExecutionRepository } from '../infrastructure/dynamo-execution-repository.js';
import { DynamoProjectRepository } from '../infrastructure/dynamo-project-repository.js';
import { makeStartExecutionHandler } from '../handlers/start-execution.js';
import { makeGetExecutionHandler } from '../handlers/get-execution.js';
import { makeListExecutionsHandler } from '../handlers/list-executions.js';
import { makeUpdateExecutionHandler } from '../handlers/update-execution.js';

// ─── Infrastructure wiring (cold-start) ─────────────────────────────────────

const tableName = process.env.TABLE_NAME!;

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const executionRepo = new DynamoExecutionRepository(docClient, tableName);
const projectRepo = new DynamoProjectRepository(docClient, tableName);

const idGenerator: IdGenerator = {
  generate: (prefix: string) => `${prefix}${randomUUID()}`,
};

// ─── Handler instances ──────────────────────────────────────────────────────

const startHandler = makeStartExecutionHandler(executionRepo, projectRepo, idGenerator);
const getHandler = makeGetExecutionHandler(executionRepo);
const listHandler = makeListExecutionsHandler(executionRepo);
const updateHandler = makeUpdateExecutionHandler(executionRepo);

// ─── Router ─────────────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const resource = event.resource;

  // POST /executions
  if (method === 'POST' && resource === '/executions') {
    return startHandler(event, context);
  }

  // GET /executions/{executionId}
  if (method === 'GET' && resource === '/executions/{executionId}') {
    return getHandler(event, context);
  }

  // GET /projects/{projectId}/executions
  if (method === 'GET' && resource === '/projects/{projectId}/executions') {
    return listHandler(event, context);
  }

  // PATCH /executions/{executionId}
  if (method === 'PATCH' && resource === '/executions/{executionId}') {
    return updateHandler(event, context);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'NOT_FOUND', message: `Unknown route: ${method} ${resource}` }),
  };
}
