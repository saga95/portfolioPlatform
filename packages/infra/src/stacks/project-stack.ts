import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'node:path';
import { ProjectTable, ProjectApi, ExecutionApi, DeploymentApi, CognitoAuth } from '@promptdeploy/cdk-constructs';

export interface ProjectStackProps extends cdk.StackProps {
  /**
   * Environment (dev, staging, prod) — affects removal policies and limits.
   */
  readonly environment: 'dev' | 'staging' | 'prod';

  /**
   * Maximum projects per tenant (default: 10).
   */
  readonly projectLimit?: number;

  /**
   * Dashboard URL(s) for Cognito OAuth callback/logout.
   * @default ['http://localhost:5173']
   */
  readonly dashboardUrls?: string[];
}

/**
 * Deployable CDK stack for the Project bounded context.
 *
 * Provisions:
 * - DynamoDB table (single-table design)
 * - Lambda function (all CRUD handlers in one)
 * - API Gateway REST API
 */
export class ProjectStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly tableName: string;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: ProjectStackProps) {
    super(scope, id, props);

    const isProd = props.environment === 'prod';
    const dashboardUrls = props.dashboardUrls ?? ['http://localhost:5173'];

    // ─── Cognito ─────────────────────────────────────────────────────

    const auth = new CognitoAuth(this, 'Auth', {
      callbackUrls: dashboardUrls,
      logoutUrls: dashboardUrls,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ─── DynamoDB ────────────────────────────────────────────────────

    const projectTable = new ProjectTable(this, 'ProjectTable', {
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: isProd,
    });

    // ─── Lambda ──────────────────────────────────────────────────────

    // Workspace root for resolving workspace: dependencies
    const workspaceRoot = path.join(__dirname, '../../../..');

    const projectHandler = new lambdaNode.NodejsFunction(this, 'ProjectHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      entry: path.join(workspaceRoot, 'packages/api/src/lambda/project-handler.ts'),
      handler: 'handler',
      projectRoot: workspaceRoot,
      depsLockFilePath: path.join(workspaceRoot, 'pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: lambdaNode.OutputFormat.ESM,
        mainFields: ['module', 'main'],
        externalModules: ['@aws-sdk/*'],
        // Resolve workspace:* packages by telling esbuild about tsconfig paths
        tsconfig: path.join(workspaceRoot, 'tsconfig.base.json'),
        esbuildArgs: {
          '--resolve-extensions': '.ts,.js,.mjs,.json',
        },
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        PROJECTS_TABLE_NAME: projectTable.tableName,
        PROJECT_LIMIT: String(props.projectLimit ?? 10),
        USER_POOL_ID: auth.userPoolId,
        USER_POOL_CLIENT_ID: auth.userPoolClientId,
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant DynamoDB read/write
    projectTable.table.grantReadWriteData(projectHandler);

    // ─── API Gateway ─────────────────────────────────────────────────

    const projectApi = new ProjectApi(this, 'ProjectApi', {
      projectHandler,
      cognitoUserPoolArn: auth.userPool.userPoolArn,
      stageName: props.environment,
    });

    // ─── Execution Lambda ────────────────────────────────────────────

    const executionHandler = new lambdaNode.NodejsFunction(this, 'ExecutionHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      entry: path.join(workspaceRoot, 'packages/api/src/lambda/execution-handler.ts'),
      handler: 'handler',
      projectRoot: workspaceRoot,
      depsLockFilePath: path.join(workspaceRoot, 'pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: lambdaNode.OutputFormat.ESM,
        mainFields: ['module', 'main'],
        externalModules: ['@aws-sdk/*'],
        tsconfig: path.join(workspaceRoot, 'tsconfig.base.json'),
        esbuildArgs: {
          '--resolve-extensions': '.ts,.js,.mjs,.json',
        },
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        TABLE_NAME: projectTable.tableName,
        USER_POOL_ID: auth.userPoolId,
        USER_POOL_CLIENT_ID: auth.userPoolClientId,
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant DynamoDB read/write for execution Lambda
    projectTable.table.grantReadWriteData(executionHandler);

    // ─── Execution API Routes ────────────────────────────────────────

    // Build Cognito authorizer method options for execution routes
    const executionAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ExecutionCognitoAuthorizer', {
      cognitoUserPools: [auth.userPool],
      identitySource: 'method.request.header.Authorization',
    });

    new ExecutionApi(this, 'ExecutionApi', {
      api: projectApi.api,
      executionHandler,
      methodOptions: {
        authorizer: executionAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // ─── Deployment Lambda ───────────────────────────────────────────

    const deploymentHandler = new lambdaNode.NodejsFunction(this, 'DeploymentHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      entry: path.join(workspaceRoot, 'packages/api/src/lambda/deployment-handler.ts'),
      handler: 'handler',
      projectRoot: workspaceRoot,
      depsLockFilePath: path.join(workspaceRoot, 'pnpm-lock.yaml'),
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        format: lambdaNode.OutputFormat.ESM,
        mainFields: ['module', 'main'],
        externalModules: ['@aws-sdk/*'],
        tsconfig: path.join(workspaceRoot, 'tsconfig.base.json'),
        esbuildArgs: {
          '--resolve-extensions': '.ts,.js,.mjs,.json',
        },
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        TABLE_NAME: projectTable.tableName,
        USER_POOL_ID: auth.userPoolId,
        USER_POOL_CLIENT_ID: auth.userPoolClientId,
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant DynamoDB read/write for deployment Lambda
    projectTable.table.grantReadWriteData(deploymentHandler);

    // ─── Deployment API Routes ───────────────────────────────────────

    const deploymentAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'DeploymentCognitoAuthorizer', {
      cognitoUserPools: [auth.userPool],
      identitySource: 'method.request.header.Authorization',
    });

    new DeploymentApi(this, 'DeploymentApi', {
      api: projectApi.api,
      deploymentHandler,
      methodOptions: {
        authorizer: deploymentAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    });

    // ─── Outputs ─────────────────────────────────────────────────────

    this.apiUrl = projectApi.apiUrl;
    this.tableName = projectTable.tableName;
    this.userPoolId = auth.userPoolId;
    this.userPoolClientId = auth.userPoolClientId;

    new cdk.CfnOutput(this, 'StackEnvironment', {
      value: props.environment,
      description: 'Deployment environment',
    });
  }
}
