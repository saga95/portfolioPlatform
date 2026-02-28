#!/usr/bin/env node
import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { ProjectStack } from '../src/index.js';

const app = new cdk.App();

const environment = (app.node.tryGetContext('environment') as string) ?? 'dev';

if (!['dev', 'staging', 'prod'].includes(environment)) {
  throw new Error(`Invalid environment: ${environment}. Must be dev, staging, or prod.`);
}

new ProjectStack(app, `PromptDeploy-Project-${environment}`, {
  environment: environment as 'dev' | 'staging' | 'prod',
  projectLimit: environment === 'prod' ? 50 : 10,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  tags: {
    project: 'promptdeploy',
    environment,
    managedBy: 'cdk',
  },
});
