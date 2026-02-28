import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CancelSubscriptionUseCase } from '@promptdeploy/core';
import type { SubscriptionRepository } from '@promptdeploy/core';
import { subscriptionPathParamsSchema, tenantHeaderSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeCancelSubscriptionHandler(
  subscriptionRepo: SubscriptionRepository,
) {
  const useCase = new CancelSubscriptionUseCase(subscriptionRepo);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    const pathResult = subscriptionPathParamsSchema.safeParse(event.pathParameters);
    if (!pathResult.success) {
      return validationError('Invalid path parameters', pathResult.error.flatten());
    }

    const result = await useCase.execute({
      tenantId,
      subscriptionId: pathResult.data.subscriptionId,
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
