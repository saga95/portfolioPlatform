import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface DeploymentApiProps {
  /**
   * The existing REST API to add deployment routes to.
   */
  readonly api: apigateway.RestApi;

  /**
   * The Lambda function for deployment operations.
   */
  readonly deploymentHandler: lambda.IFunction;

  /**
   * Optional method options (e.g., Cognito authorizer).
   */
  readonly methodOptions?: apigateway.MethodOptions;
}

/**
 * Adds deployment routes to an existing REST API.
 *
 * Routes:
 *   POST   /deployments                          → startDeployment
 *   GET    /deployments/{deploymentId}            → getDeployment
 *   PATCH  /deployments/{deploymentId}            → updateDeployment
 *   GET    /projects/{projectId}/deployments      → listDeployments
 */
export class DeploymentApi extends Construct {
  constructor(scope: Construct, id: string, props: DeploymentApiProps) {
    super(scope, id);

    const integration = new apigateway.LambdaIntegration(props.deploymentHandler);
    const opts = props.methodOptions ?? {};

    // /deployments
    const deployments = props.api.root.addResource('deployments');
    deployments.addMethod('POST', integration, opts);          // Start deployment

    // /deployments/{deploymentId}
    const deployment = deployments.addResource('{deploymentId}');
    deployment.addMethod('GET', integration, opts);            // Get deployment
    deployment.addMethod('PATCH', integration, opts);          // Update deployment

    // /projects/{projectId}/deployments — attach to existing projects resource
    let projects = props.api.root.getResource('projects');
    if (!projects) {
      projects = props.api.root.addResource('projects');
    }
    let projectResource = projects.getResource('{projectId}');
    if (!projectResource) {
      projectResource = projects.addResource('{projectId}');
    }
    const projectDeployments = projectResource.addResource('deployments');
    projectDeployments.addMethod('GET', integration, opts);    // List deployments
  }
}
