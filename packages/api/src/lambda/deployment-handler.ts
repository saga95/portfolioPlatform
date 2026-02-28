/**
 * Lambda entry point for the Deployment API.
 *
 * This file wires together:
 * - DynamoDB client → DynamoDeploymentRepository + DynamoProjectRepository adapters
 * - UUID-based IdGenerator (with prefix)
 * - All deployment handler factory functions
 *
 * API Gateway routes all /deployments/* and /projects/{projectId}/deployments requests
 * to this single Lambda. The handler dispatches based on HTTP method + resource path.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { IdGenerator } from '../../../../core/src/domain/ports/id-generator.js';
import { DynamoDeploymentRepository } from '../infrastructure/dynamo-deployment-repository.js';
import { DynamoProjectRepository } from '../infrastructure/dynamo-project-repository.js';
import { makeStartDeploymentHandler } from '../handlers/start-deployment.js';
import { makeGetDeploymentHandler } from '../handlers/get-deployment.js';
import { makeListDeploymentsHandler } from '../handlers/list-deployments.js';
import { makeUpdateDeploymentHandler } from '../handlers/update-deployment.js';

// ─── Infrastructure wiring (cold-start) ─────────────────────────────────────

const tableName = process.env.TABLE_NAME!;

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const deploymentRepo = new DynamoDeploymentRepository(docClient, tableName);
const projectRepo = new DynamoProjectRepository(docClient, tableName);

const idGenerator: IdGenerator = {
  generate: (prefix: string) => `${prefix}${randomUUID()}`,
};

// ─── Handler instances ──────────────────────────────────────────────────────

const startHandler = makeStartDeploymentHandler(deploymentRepo, projectRepo, idGenerator);
const getHandler = makeGetDeploymentHandler(deploymentRepo);
const listHandler = makeListDeploymentsHandler(deploymentRepo);
const updateHandler = makeUpdateDeploymentHandler(deploymentRepo);

// ─── Router ─────────────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const resource = event.resource;

  // POST /deployments
  if (method === 'POST' && resource === '/deployments') {
    return startHandler(event, context);
  }

  // GET /deployments/{deploymentId}
  if (method === 'GET' && resource === '/deployments/{deploymentId}') {
    return getHandler(event, context);
  }

  // GET /projects/{projectId}/deployments
  if (method === 'GET' && resource === '/projects/{projectId}/deployments') {
    return listHandler(event, context);
  }

  // PATCH /deployments/{deploymentId}
  if (method === 'PATCH' && resource === '/deployments/{deploymentId}') {
    return updateHandler(event, context);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'NOT_FOUND', message: `Unknown route: ${method} ${resource}` }),
  };
}
