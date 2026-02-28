import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface BillingApiProps {
  /**
   * The existing REST API to add billing routes to.
   */
  readonly api: apigateway.RestApi;

  /**
   * The Lambda function for billing/subscription operations.
   */
  readonly billingHandler: lambda.IFunction;

  /**
   * Method options for authenticated routes (e.g., Cognito authorizer).
   */
  readonly methodOptions?: apigateway.MethodOptions;
}

/**
 * Adds billing and subscription routes to an existing REST API.
 *
 * Routes (authenticated):
 *   POST   /subscriptions                         → createSubscription
 *   GET    /subscriptions                          → listSubscriptions
 *   GET    /subscriptions/{subscriptionId}         → getSubscription
 *   DELETE /subscriptions/{subscriptionId}         → cancelSubscription
 *
 * Routes (unauthenticated — PayHere server callback):
 *   POST   /billing/webhook                        → payHereWebhook
 */
export class BillingApi extends Construct {
  constructor(scope: Construct, id: string, props: BillingApiProps) {
    super(scope, id);

    const integration = new apigateway.LambdaIntegration(props.billingHandler);
    const opts = props.methodOptions ?? {};

    // /subscriptions (authenticated)
    const subscriptions = props.api.root.addResource('subscriptions');
    subscriptions.addMethod('POST', integration, opts);        // Create subscription
    subscriptions.addMethod('GET', integration, opts);         // List subscriptions

    // /subscriptions/{subscriptionId} (authenticated)
    const subscription = subscriptions.addResource('{subscriptionId}');
    subscription.addMethod('GET', integration, opts);          // Get subscription
    subscription.addMethod('DELETE', integration, opts);       // Cancel subscription

    // /billing/webhook (NO auth — PayHere server-to-server callback)
    const billing = props.api.root.addResource('billing');
    const webhook = billing.addResource('webhook');
    webhook.addMethod('POST', integration);                    // PayHere webhook (no auth)
  }
}
