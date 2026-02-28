import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import cors from '@middy/http-cors';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ListSubscriptionsUseCase } from '@promptdeploy/core';
import type { SubscriptionRepository } from '@promptdeploy/core';
import { listSubscriptionsQuerySchema, tenantHeaderSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';

export function makeListSubscriptionsHandler(
  subscriptionRepo: SubscriptionRepository,
) {
  const useCase = new ListSubscriptionsUseCase(subscriptionRepo);

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    const headerResult = tenantHeaderSchema.safeParse(event.headers);
    if (!headerResult.success) {
      return validationError('Missing or invalid x-tenant-id header', headerResult.error.flatten());
    }
    const tenantId = headerResult.data['x-tenant-id'];

    const queryResult = listSubscriptionsQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!queryResult.success) {
      return validationError('Invalid query parameters', queryResult.error.flatten());
    }

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
