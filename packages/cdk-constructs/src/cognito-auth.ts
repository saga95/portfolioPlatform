import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export interface CognitoAuthProps {
  /**
   * Allowed callback URLs for the hosted UI / frontend.
   * @example ['http://localhost:5173', 'https://app.promptdeploy.com']
   */
  readonly callbackUrls: string[];

  /**
   * Allowed logout URLs.
   * @example ['http://localhost:5173', 'https://app.promptdeploy.com']
   */
  readonly logoutUrls: string[];

  /**
   * Removal policy for user pool (DESTROY for dev, RETAIN for prod).
   */
  readonly removalPolicy?: cdk.RemovalPolicy;

  /**
   * Whether to send email verification (default: true).
   */
  readonly selfSignUp?: boolean;
}

/**
 * Cognito User Pool construct for PromptDeploy Identity bounded context.
 *
 * Features:
 * - Email-based sign-up with verification
 * - Custom attributes: tenantId, plan
 * - OAuth2 PKCE flow for SPA
 * - User Pool Client for the dashboard
 */
export class CognitoAuth extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: CognitoAuthProps) {
    super(scope, id);

    // ─── User Pool ───────────────────────────────────────────────────

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'promptdeploy-users',
      selfSignUpEnabled: props.selfSignUp ?? true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      customAttributes: {
        tenantId: new cognito.StringAttribute({
          mutable: true,
          minLen: 1,
          maxLen: 128,
        }),
        plan: new cognito.StringAttribute({
          mutable: true,
          minLen: 1,
          maxLen: 20,
        }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.RETAIN,
    });

    // ─── User Pool Client (SPA / PKCE) ──────────────────────────────

    this.userPoolClient = this.userPool.addClient('DashboardClient', {
      userPoolClientName: 'promptdeploy-dashboard',
      generateSecret: false, // SPA — no client secret
      authFlows: {
        userSrp: true,
        userPassword: false,
        custom: false,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: props.callbackUrls,
        logoutUrls: props.logoutUrls,
      },
      idTokenValidity: cdk.Duration.hours(1),
      accessTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true, fullname: true })
        .withCustomAttributes('tenantId', 'plan'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ fullname: true }),
    });

    // ─── Expose values ───────────────────────────────────────────────

    this.userPoolId = this.userPool.userPoolId;
    this.userPoolClientId = this.userPoolClient.userPoolClientId;

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });
  }
}
