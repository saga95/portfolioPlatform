import middy from '@middy/core';
import httpErrorHandler from '@middy/http-error-handler';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { HandlePayHereWebhookUseCase } from '@promptdeploy/core';
import type { SubscriptionRepository, WebhookHashGenerator } from '@promptdeploy/core';
import { payhereWebhookSchema } from '../schemas/index.js';
import { success, domainErrorResponse, validationError } from '../lib/responses.js';
import * as querystring from 'node:querystring';

/**
 * PayHere webhook handler.
 *
 * This handler does NOT use Cognito auth — PayHere sends server-to-server
 * callbacks to the notify_url.
 *
 * PayHere sends data as application/x-www-form-urlencoded.
 */
export function makePayHereWebhookHandler(
  subscriptionRepo: SubscriptionRepository,
  merchantId: string,
  merchantSecret: string,
  hashGenerator: WebhookHashGenerator,
) {
  const useCase = new HandlePayHereWebhookUseCase(
    subscriptionRepo,
    merchantId,
    merchantSecret,
    hashGenerator,
  );

  const handler = async (
    event: APIGatewayProxyEvent,
  ): Promise<APIGatewayProxyResult> => {
    // Parse x-www-form-urlencoded body
    let body: Record<string, unknown>;
    try {
      if (event.isBase64Encoded && event.body) {
        const decoded = Buffer.from(event.body, 'base64').toString('utf-8');
        body = querystring.parse(decoded) as Record<string, unknown>;
      } else if (event.body && typeof event.body === 'string') {
        // Try JSON first (in case Middy already parsed it), then form-urlencoded
        try {
          body = JSON.parse(event.body);
        } catch {
          body = querystring.parse(event.body) as Record<string, unknown>;
        }
      } else if (event.body && typeof event.body === 'object') {
        body = event.body as Record<string, unknown>;
      } else {
        return validationError('Missing request body');
      }
    } catch {
      return validationError('Failed to parse request body');
    }

    const bodyResult = payhereWebhookSchema.safeParse(body);
    if (!bodyResult.success) {
      return validationError('Invalid webhook payload', bodyResult.error.flatten());
    }

    const data = bodyResult.data;
    const result = await useCase.execute({
      merchantId: data.merchant_id,
      orderId: data.order_id,
      paymentId: data.payment_id,
      subscriptionId: data.subscription_id,
      payhereAmount: data.payhere_amount,
      payhereCurrency: data.payhere_currency,
      statusCode: data.status_code,
      md5sig: data.md5sig,
      messageType: data.message_type,
      itemRecStatus: data.item_rec_status,
      itemRecDateNext: data.item_rec_date_next,
      custom1: data.custom_1,
      custom2: data.custom_2,
    });

    if (result.ok) {
      return success({ received: true });
    }
    return domainErrorResponse(result.error);
  };

  return middy(handler)
    .use(httpErrorHandler());
  // No CORS — this is a server-to-server callback
  // No jsonBodyParser — PayHere uses x-www-form-urlencoded
}
