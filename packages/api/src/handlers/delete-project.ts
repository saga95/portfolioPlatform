import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteProjectUseCase } from '@promptdeploy/core';
import type { ProjectRepository } from '@promptdeploy/core';
import { projectPathParamsSchema, tenantHeaderSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeDeleteProjectHandler(projectRepo: ProjectRepository) {
  const useCase = new DeleteProjectUseCase(projectRepo);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    // 1. Validate tenant header
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    // 2. Validate path params
    const pathResult = projectPathParamsSchema.safeParse(event.pathParameters);
    if (!pathResult.success) {
      return validationError('Invalid project ID', pathResult.error.flatten());
    }

    // 3. Execute
    const result = await useCase.execute({
      tenantId,
      projectId: pathResult.data.projectId,
    });

    if (result.ok) {
      return success({ message: 'Project deleted' }, 200);
    }
    return domainErrorResponse(result.error);
  };

  return middy(handler)
    .use(httpErrorHandler())
    .use(cors());
}
