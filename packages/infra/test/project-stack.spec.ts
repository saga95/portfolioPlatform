import { describe, it, expect } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ProjectStack } from '../src/index.js';

describe('ProjectStack', () => {
  function createStack(env: 'dev' | 'staging' | 'prod' = 'dev') {
    const app = new cdk.App();
    return new ProjectStack(app, 'TestStack', {
      environment: env,
      dashboardUrls: ['http://localhost:5173'],
    });
  }

  it('should create a DynamoDB table', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::DynamoDB::Table', 1);
  }, 30_000);

  it('should create Lambda functions for project, execution, deployment, and billing handlers', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Lambda::Function', 4);
  });

  it('should create an API Gateway REST API', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  });

  it('should create a Cognito User Pool', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
  });

  it('should create a Cognito User Pool Client', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
  });

  it('should create a Cognito authorizer on API Gateway', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'COGNITO_USER_POOLS',
    });
  });

  it('should pass environment variables to Lambda', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          PROJECT_LIMIT: '10',
        }),
      },
    });
  });

  it('should use DESTROY removal policy for dev', () => {
    const stack = createStack('dev');
    const template = Template.fromStack(stack);
    template.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Delete',
    });
  });

  it('should use RETAIN removal policy for prod', () => {
    const stack = createStack('prod');
    const template = Template.fromStack(stack);
    template.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
    });
  });

  it('should use RETAIN for Cognito User Pool in prod', () => {
    const stack = createStack('prod');
    const template = Template.fromStack(stack);
    template.hasResource('AWS::Cognito::UserPool', {
      DeletionPolicy: 'Retain',
    });
  });

  it('should grant all Lambdas access to table via IAM', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    // project + execution + deployment + billing Lambdas should have IAM policies for DynamoDB
    template.resourceCountIs('AWS::IAM::Policy', 4);
  });

  it('should expose stack outputs', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    // API URL, User Pool ID, User Pool Client ID, environment
    const outputs = template.findOutputs('*');
    expect(Object.keys(outputs).length).toBeGreaterThanOrEqual(4);
  });

  it('should create execution Lambda with TABLE_NAME env var', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it('should create four Cognito authorizers', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    const authorizers = template.findResources('AWS::ApiGateway::Authorizer', {
      Properties: { Type: 'COGNITO_USER_POOLS' },
    });
    expect(Object.keys(authorizers).length).toBe(4);
  });

  it('should pass PayHere environment variables to billing Lambda', () => {
    const stack = createStack();
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          PAYHERE_SANDBOX: 'true',
        }),
      },
    });
  });
});
