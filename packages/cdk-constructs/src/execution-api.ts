import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface ExecutionApiProps {
  /**
   * The existing REST API to add execution routes to.
   */
  readonly api: apigateway.RestApi;

  /**
   * The Lambda function for execution operations.
   */
  readonly executionHandler: lambda.IFunction;

  /**
   * Optional method options (e.g., Cognito authorizer).
   */
  readonly methodOptions?: apigateway.MethodOptions;
}

/**
 * Adds execution routes to an existing REST API.
 *
 * Routes:
 *   POST   /executions                          → startExecution
 *   GET    /executions/{executionId}             → getExecution
 *   PATCH  /executions/{executionId}             → updateExecution
 *   GET    /projects/{projectId}/executions      → listExecutions
 */
export class ExecutionApi extends Construct {
  constructor(scope: Construct, id: string, props: ExecutionApiProps) {
    super(scope, id);

    const integration = new apigateway.LambdaIntegration(props.executionHandler);
    const opts = props.methodOptions ?? {};

    // /executions
    const executions = props.api.root.addResource('executions');
    executions.addMethod('POST', integration, opts);          // Start execution

    // /executions/{executionId}
    const execution = executions.addResource('{executionId}');
    execution.addMethod('GET', integration, opts);            // Get execution
    execution.addMethod('PATCH', integration, opts);          // Update execution (approve/cancel/retry)

    // /projects/{projectId}/executions — attach to existing projects resource
    // We need to find or create the /projects/{projectId} resource
    let projects = props.api.root.getResource('projects');
    if (!projects) {
      projects = props.api.root.addResource('projects');
    }
    let projectResource = projects.getResource('{projectId}');
    if (!projectResource) {
      projectResource = projects.addResource('{projectId}');
    }
    const projectExecutions = projectResource.addResource('executions');
    projectExecutions.addMethod('GET', integration, opts);    // List executions
  }
}
