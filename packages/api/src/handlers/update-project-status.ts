import middy from '@middy/core';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateProjectStatusUseCase } from '@promptdeploy/core';
import type { ProjectRepository } from '@promptdeploy/core';
import {
  updateProjectStatusSchema,
  projectPathParamsSchema,
  tenantHeaderSchema,
} from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeUpdateProjectStatusHandler(projectRepo: ProjectRepository) {
  const useCase = new UpdateProjectStatusUseCase(projectRepo);

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

    // 3. Validate body
    const bodyResult = updateProjectStatusSchema.safeParse(event.body);
    if (!bodyResult.success) {
      return validationError('Invalid request body', bodyResult.error.flatten());
    }

    // 4. Execute
    const result = await useCase.execute({
      tenantId,
      projectId: pathResult.data.projectId,
      action: bodyResult.data.action,
      deployedUrl: bodyResult.data.deployedUrl,
    });

    if (result.ok) {
      return success(result.value);
    }
    return domainErrorResponse(result.error);
  };

  return middy(handler)
    .use(jsonBodyParser())
    .use(httpErrorHandler())
    .use(cors());
}
