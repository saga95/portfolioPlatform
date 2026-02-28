import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ListProjectsUseCase } from '@promptdeploy/core';
import type { ProjectRepository } from '@promptdeploy/core';
import { listProjectsQuerySchema, tenantHeaderSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeListProjectsHandler(projectRepo: ProjectRepository) {
  const useCase = new ListProjectsUseCase(projectRepo);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    // 1. Validate tenant header
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    // 2. Parse optional query params
    const queryResult = listProjectsQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!queryResult.success) {
      return validationError('Invalid query parameters', queryResult.error.flatten());
    }

    // 3. Execute
    const result = await useCase.execute({
      tenantId,
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
