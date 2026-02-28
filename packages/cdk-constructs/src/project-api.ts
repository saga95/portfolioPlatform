import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';

export interface ProjectApiProps {
  /**
   * The Lambda function for project CRUD operations.
   */
  readonly projectHandler: lambda.IFunction;

  /**
   * Optional Cognito User Pool ARN for protecting endpoints.
   * When provided, all routes require a valid JWT token.
   */
  readonly cognitoUserPoolArn?: string;

  /**
   * API stage name.
   */
  readonly stageName?: string;
}

/**
 * REST API Gateway construct for the Project bounded context.
 *
 * Routes:
 *   POST   /projects              → createProject
 *   GET    /projects              → listProjects
 *   GET    /projects/{projectId}  → getProject
 *   PATCH  /projects/{projectId}/status → updateProjectStatus
 *   DELETE /projects/{projectId}  → deleteProject
 */
export class ProjectApi extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ProjectApiProps) {
    super(scope, id);

    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'PromptDeploy Project API',
      description: 'API for managing PromptDeploy projects',
      deployOptions: {
        stageName: props.stageName ?? 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Tenant-Id',
          'X-Amz-Date',
          'X-Api-Key',
        ],
      },
    });

    const integration = new apigateway.LambdaIntegration(props.projectHandler);

    // Optional Cognito authorizer
    let methodOptions: apigateway.MethodOptions = {};
    if (props.cognitoUserPoolArn) {
      const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
        cognitoUserPools: [
          cognito.UserPool.fromUserPoolArn(this, 'ImportedUserPool', props.cognitoUserPoolArn),
        ],
        identitySource: 'method.request.header.Authorization',
      });
      methodOptions = {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      };
    }

    // /projects
    const projects = this.api.root.addResource('projects');
    projects.addMethod('POST', integration, methodOptions);   // Create
    projects.addMethod('GET', integration, methodOptions);    // List

    // /projects/{projectId}
    const project = projects.addResource('{projectId}');
    project.addMethod('GET', integration, methodOptions);     // Get
    project.addMethod('DELETE', integration, methodOptions);  // Delete

    // /projects/{projectId}/status
    const status = project.addResource('status');
    status.addMethod('PATCH', integration, methodOptions);    // Update status

    this.apiUrl = this.api.url;

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'Project API URL',
    });
  }
}
