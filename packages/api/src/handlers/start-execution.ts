import middy from '@middy/core';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StartExecutionUseCase } from '@promptdeploy/core';
import type { ExecutionRepository, ProjectRepository, IdGenerator } from '@promptdeploy/core';
import { startExecutionSchema, tenantHeaderSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeStartExecutionHandler(
  executionRepo: ExecutionRepository,
  projectRepo: ProjectRepository,
  idGenerator: IdGenerator,
) {
  const useCase = new StartExecutionUseCase(executionRepo, projectRepo, idGenerator);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    const bodyResult = startExecutionSchema.safeParse(event.body);
    if (!bodyResult.success) {
      return validationError('Invalid request body', bodyResult.error.flatten());
    }

    // Extract plan from Cognito claims or default to 'free'
    const claims = event.requestContext.authorizer?.claims;
    const plan = claims?.['custom:plan'] ?? 'free';

    const result = await useCase.execute(
      {
        tenantId,
        projectId: bodyResult.data.projectId,
        tokensBudget: bodyResult.data.tokensBudget,
      },
      plan,
    );

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
