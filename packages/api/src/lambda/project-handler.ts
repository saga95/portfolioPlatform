/**
 * Lambda entry point for the Project API.
 *
 * This file wires together:
 * - DynamoDB client → DynamoProjectRepository adapter
 * - UUID-based IdGenerator
 * - All handler factory functions from @promptdeploy/api
 *
 * API Gateway routes all /projects/* requests to this single Lambda.
 * The handler dispatches based on HTTP method + resource path.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { IdGenerator } from '../../../../core/src/domain/ports/id-generator.js';
import { DynamoProjectRepository } from '../infrastructure/dynamo-project-repository.js';
import { makeCreateProjectHandler } from '../handlers/create-project.js';
import { makeGetProjectHandler } from '../handlers/get-project.js';
import { makeListProjectsHandler } from '../handlers/list-projects.js';
import { makeUpdateProjectStatusHandler } from '../handlers/update-project-status.js';
import { makeDeleteProjectHandler } from '../handlers/delete-project.js';

// ─── Infrastructure wiring (cold-start) ─────────────────────────────────────

const tableName = process.env.PROJECTS_TABLE_NAME!;
const projectLimit = Number(process.env.PROJECT_LIMIT ?? '10');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const projectRepo = new DynamoProjectRepository(docClient, tableName);

const idGenerator: IdGenerator = {
  generate: (prefix: string) => `${prefix}${randomUUID()}`,
};

// ─── Handler instances ──────────────────────────────────────────────────────

const createHandler = makeCreateProjectHandler(projectRepo, idGenerator, projectLimit);
const getHandler = makeGetProjectHandler(projectRepo);
const listHandler = makeListProjectsHandler(projectRepo);
const updateStatusHandler = makeUpdateProjectStatusHandler(projectRepo);
const deleteHandler = makeDeleteProjectHandler(projectRepo);

// ─── Router ─────────────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const resource = event.resource;

  // POST /projects
  if (method === 'POST' && resource === '/projects') {
    return createHandler(event, context);
  }

  // GET /projects
  if (method === 'GET' && resource === '/projects') {
    return listHandler(event, context);
  }

  // GET /projects/{projectId}
  if (method === 'GET' && resource === '/projects/{projectId}') {
    return getHandler(event, context);
  }

  // PATCH /projects/{projectId}/status
  if (method === 'PATCH' && resource === '/projects/{projectId}/status') {
    return updateStatusHandler(event, context);
  }

  // DELETE /projects/{projectId}
  if (method === 'DELETE' && resource === '/projects/{projectId}') {
    return deleteHandler(event, context);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'NOT_FOUND', message: `Unknown route: ${method} ${resource}` }),
  };
}
