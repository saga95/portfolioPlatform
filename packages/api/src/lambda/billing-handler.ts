/**
 * Lambda entry point for the Billing API.
 *
 * This file wires together:
 * - DynamoDB client → DynamoSubscriptionRepository adapter
 * - UUID-based IdGenerator (with prefix)
 * - NodeHashGenerator for PayHere HMAC
 * - All billing handler factory functions
 *
 * API Gateway routes all /subscriptions/* and /billing/* requests
 * to this single Lambda. The handler dispatches based on HTTP method + resource path.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { IdGenerator, PayHereConfig } from '../../../../core/src/application/use-cases/create-subscription.js';
import { DynamoSubscriptionRepository } from '../infrastructure/dynamo-subscription-repository.js';
import { NodeHashGenerator } from '../infrastructure/node-hash-generator.js';
import { makeCreateSubscriptionHandler } from '../handlers/create-subscription.js';
import { makeGetSubscriptionHandler } from '../handlers/get-subscription.js';
import { makeListSubscriptionsHandler } from '../handlers/list-subscriptions.js';
import { makeCancelSubscriptionHandler } from '../handlers/cancel-subscription.js';
import { makePayHereWebhookHandler } from '../handlers/payhere-webhook.js';

// ─── Infrastructure wiring (cold-start) ─────────────────────────────────────

const tableName = process.env.TABLE_NAME!;
const merchantId = process.env.PAYHERE_MERCHANT_ID!;
const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET!;
const notifyUrl = process.env.PAYHERE_NOTIFY_URL!;
const returnUrl = process.env.PAYHERE_RETURN_URL!;
const cancelUrl = process.env.PAYHERE_CANCEL_URL!;
const sandbox = process.env.PAYHERE_SANDBOX === 'true';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const subscriptionRepo = new DynamoSubscriptionRepository(docClient, tableName);
const hashGenerator = new NodeHashGenerator();

const idGenerator: IdGenerator = {
  generate: (prefix: string) => `${prefix}${randomUUID()}`,
};

const payhereConfig: PayHereConfig = {
  merchantId,
  merchantSecret,
  notifyUrl,
  returnUrl,
  cancelUrl,
  sandbox,
};

// ─── Handler instances ──────────────────────────────────────────────────────

const createHandler = makeCreateSubscriptionHandler(subscriptionRepo, idGenerator, payhereConfig, hashGenerator);
const getHandler = makeGetSubscriptionHandler(subscriptionRepo);
const listHandler = makeListSubscriptionsHandler(subscriptionRepo);
const cancelHandler = makeCancelSubscriptionHandler(subscriptionRepo);
const webhookHandler = makePayHereWebhookHandler(subscriptionRepo, merchantId, merchantSecret, hashGenerator);

// ─── Router ─────────────────────────────────────────────────────────────────

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const resource = event.resource;

  // POST /subscriptions — Create new subscription (returns PayHere checkout params)
  if (method === 'POST' && resource === '/subscriptions') {
    return createHandler(event, context);
  }

  // GET /subscriptions/{subscriptionId} — Get subscription
  if (method === 'GET' && resource === '/subscriptions/{subscriptionId}') {
    return getHandler(event, context);
  }

  // GET /subscriptions — List subscriptions for tenant
  if (method === 'GET' && resource === '/subscriptions') {
    return listHandler(event, context);
  }

  // DELETE /subscriptions/{subscriptionId} — Cancel subscription
  if (method === 'DELETE' && resource === '/subscriptions/{subscriptionId}') {
    return cancelHandler(event, context);
  }

  // POST /billing/webhook — PayHere webhook callback (no auth)
  if (method === 'POST' && resource === '/billing/webhook') {
    return webhookHandler(event, context);
  }

  return {
    statusCode: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'NOT_FOUND', message: `Unknown route: ${method} ${resource}` }),
  };
}
