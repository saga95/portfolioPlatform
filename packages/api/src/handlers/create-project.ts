import middy from '@middy/core';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CreateProjectUseCase } from '@promptdeploy/core';
import type { ProjectRepository, IdGenerator } from '@promptdeploy/core';
import { createProjectSchema, tenantHeaderSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

/**
 * Factory function that creates the handler with injected dependencies.
 * This supports Clean Architecture — dependencies are provided from outside.
 */
export function makeCreateProjectHandler(
  projectRepo: ProjectRepository,
  idGenerator: IdGenerator,
  projectLimit?: number,
) {
  const useCase = new CreateProjectUseCase(projectRepo, idGenerator);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    // 1. Extract & validate tenant from headers
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    // 2. Validate request body
    const bodyResult = createProjectSchema.safeParse(event.body);
    if (!bodyResult.success) {
      return validationError('Invalid request body', bodyResult.error.flatten());
    }

    // 3. Execute use case
    const result = await useCase.execute(
      {
        tenantId,
        name: bodyResult.data.name,
        description: bodyResult.data.description,
        templateId: bodyResult.data.templateId,
      },
      projectLimit,
    );

    // 4. Return response
    if (result.ok) {
      return success(result.value, 201);
    }
    return domainErrorResponse(result.error);
  };

  return middy(handler)
    .use(jsonBodyParser())
    .use(httpErrorHandler())
    .use(cors());
}
