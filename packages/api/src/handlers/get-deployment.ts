import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetDeploymentUseCase } from '@promptdeploy/core';
import type { DeploymentRepository } from '@promptdeploy/core';
import { deploymentPathParamsSchema, tenantHeaderSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeGetDeploymentHandler(deploymentRepo: DeploymentRepository) {
  const useCase = new GetDeploymentUseCase(deploymentRepo);

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

    const result = await useCase.execute({
      tenantId,
      deploymentId: pathResult.data.deploymentId,
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
