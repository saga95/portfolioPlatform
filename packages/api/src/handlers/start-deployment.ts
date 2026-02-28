import middy from '@middy/core';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { StartDeploymentUseCase } from '@promptdeploy/core';
import type { DeploymentRepository, ProjectRepository, IdGenerator } from '@promptdeploy/core';
import { startDeploymentSchema, tenantHeaderSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeStartDeploymentHandler(
  deploymentRepo: DeploymentRepository,
  projectRepo: ProjectRepository,
  idGenerator: IdGenerator,
) {
  const useCase = new StartDeploymentUseCase(deploymentRepo, projectRepo, idGenerator);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    const bodyResult = startDeploymentSchema.safeParse(event.body);
    if (!bodyResult.success) {
      return validationError('Invalid request body', bodyResult.error.flatten());
    }

    const result = await useCase.execute({
      tenantId,
      projectId: bodyResult.data.projectId,
      version: bodyResult.data.version,
    });

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
