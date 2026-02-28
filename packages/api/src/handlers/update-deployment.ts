import middy from '@middy/core';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateDeploymentUseCase } from '@promptdeploy/core';
import type { DeploymentRepository } from '@promptdeploy/core';
import {
  updateDeploymentSchema,
  deploymentPathParamsSchema,
  tenantHeaderSchema,
} from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeUpdateDeploymentHandler(deploymentRepo: DeploymentRepository) {
  const useCase = new UpdateDeploymentUseCase(deploymentRepo);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    const pathResult = deploymentPathParamsSchema.safeParse(event.pathParameters);
    if (!pathResult.success) {
      return validationError('Invalid deployment ID', pathResult.error.flatten());
    }

    const bodyResult = updateDeploymentSchema.safeParse(event.body);
    if (!bodyResult.success) {
      return validationError('Invalid request body', bodyResult.error.flatten());
    }

    const result = await useCase.execute({
      tenantId,
      deploymentId: pathResult.data.deploymentId,
      action: bodyResult.data.action,
      deployedUrl: bodyResult.data.deployedUrl,
      errorMessage: bodyResult.data.errorMessage,
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
