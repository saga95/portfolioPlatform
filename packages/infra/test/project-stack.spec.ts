import { describe, it, expect, beforeAll } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ProjectStack } from '../src/index.js';

describe('ProjectStack', () => {
  let devTemplate: Template;
  let prodTemplate: Template;

  beforeAll(() => {
    const devApp = new cdk.App();
    const devStack = new ProjectStack(devApp, 'TestStackDev', {
      environment: 'dev',
      dashboardUrls: ['http://localhost:5173'],
    });
    devTemplate = Template.fromStack(devStack);

    const prodApp = new cdk.App();
    const prodStack = new ProjectStack(prodApp, 'TestStackProd', {
      environment: 'prod',
      dashboardUrls: ['https://app.promptdeploy.io'],
    });
    prodTemplate = Template.fromStack(prodStack);
  }, 60_000);

  it('should create a DynamoDB table', () => {
    devTemplate.resourceCountIs('AWS::DynamoDB::Table', 1);
  });

  it('should create Lambda functions for project, execution, deployment, and billing handlers', () => {
    // 4 application Lambdas + 1 custom resource Lambda (S3 auto-delete)
    devTemplate.resourceCountIs('AWS::Lambda::Function', 5);
  });

  it('should create an API Gateway REST API', () => {
    devTemplate.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  });

  it('should create a Cognito User Pool', () => {
    devTemplate.resourceCountIs('AWS::Cognito::UserPool', 1);
  });

  it('should create a Cognito User Pool Client', () => {
    devTemplate.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
  });

  it('should create a Cognito authorizer on API Gateway', () => {
    devTemplate.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'COGNITO_USER_POOLS',
    });
  });

  it('should pass environment variables to Lambda', () => {
    devTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          PROJECT_LIMIT: '10',
        }),
      },
    });
  });

  it('should use DESTROY removal policy for dev', () => {
    devTemplate.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Delete',
    });
  });

  it('should use RETAIN removal policy for prod', () => {
    prodTemplate.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
    });
  });

  it('should use RETAIN for Cognito User Pool in prod', () => {
    prodTemplate.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
    });
  });

  it('should grant all Lambdas access to table via IAM', () => {
    // 4 application Lambda policies for DynamoDB access
    devTemplate.resourceCountIs('AWS::IAM::Policy', 4);
  });

  it('should expose stack outputs', () => {
    const outputs = devTemplate.findOutputs('*');
    // API URL, User Pool ID, User Pool Client ID, environment, dashboard bucket, distribution ID, dashboard URL
    expect(Object.keys(outputs).length).toBeGreaterThanOrEqual(7);
  });

  it('should create execution Lambda with TABLE_NAME env var', () => {
    devTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it('should create four Cognito authorizers', () => {
    const authorizers = devTemplate.findResources('AWS::ApiGateway::Authorizer', {
      Properties: { Type: 'COGNITO_USER_POOLS' },
    });
    expect(Object.keys(authorizers).length).toBe(4);
  });

  it('should pass PayHere environment variables to billing Lambda', () => {
    devTemplate.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          PAYHERE_SANDBOX: 'true',
        }),
      },
    });
  });

  it('should create an S3 bucket for dashboard hosting', () => {
    devTemplate.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('should create a CloudFront distribution for dashboard', () => {
    devTemplate.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  it('should output dashboard bucket name and CloudFront URL', () => {
    const outputs = devTemplate.findOutputs('*');
    const outputKeys = Object.keys(outputs).map((k) => k.toLowerCase());
    expect(outputKeys.some((k) => k.includes('dashboardbucket'))).toBe(true);
    expect(outputKeys.some((k) => k.includes('dashboardurl'))).toBe(true);
  });
});
