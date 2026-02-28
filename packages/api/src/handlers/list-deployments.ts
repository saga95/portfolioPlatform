import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ListDeploymentsUseCase } from '@promptdeploy/core';
import type { DeploymentRepository } from '@promptdeploy/core';
import {
  projectPathParamsSchema,
  listDeploymentsQuerySchema,
  tenantHeaderSchema,
} from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeListDeploymentsHandler(deploymentRepo: DeploymentRepository) {
  const useCase = new ListDeploymentsUseCase(deploymentRepo);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    const pathResult = projectPathParamsSchema.safeParse(event.pathParameters);
    if (!pathResult.success) {
      return validationError('Invalid project ID', pathResult.error.flatten());
    }

    const queryResult = listDeploymentsQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!queryResult.success) {
      return validationError('Invalid query parameters', queryResult.error.flatten());
    }

    const result = await useCase.execute({
      tenantId,
      projectId: pathResult.data.projectId,
      nextToken: queryResult.data.nextToken,
    });

    if (result.ok) {
      return success(result.value);
    }
    return domainErrorResponse(result.error);
  };

  return middy(handler)
    .use(httpErrorHandler())
    .use(cors());
}
