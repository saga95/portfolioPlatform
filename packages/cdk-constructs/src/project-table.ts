import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib';

export interface ProjectTableProps {
  /**
   * The removal policy for the table.
   * Use DESTROY for dev/staging, RETAIN for production.
   */
  readonly removalPolicy?: cdk.RemovalPolicy;

  /**
   * Enable point-in-time recovery (recommended for production).
   */
  readonly pointInTimeRecovery?: boolean;
}

/**
 * DynamoDB single-table construct for the Project bounded context.
 *
 * Key schema:
 * - PK: `TENANT#<tenantId>`
 * - SK: `PROJECT#<projectId>`
 *
 * GSI1 (StatusIndex):
 * - GSI1PK: `TENANT#<tenantId>`
 * - GSI1SK: `STATUS#<status>#<updatedAt>`
 *
 * This enables:
 * - Get project by tenant + project ID (PK + SK)
 * - List all projects for a tenant (PK begins_with)
 * - Filter projects by status for a tenant (GSI1)
 */
export class ProjectTable extends Construct {
  public readonly table: dynamodb.Table;
  public readonly tableName: string;
  public readonly tableArn: string;

  constructor(scope: Construct, id: string, props: ProjectTableProps = {}) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: `promptdeploy-projects`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: props.pointInTimeRecovery ?? true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
    });

    // GSI1: Query projects by status within a tenant
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.tableName = this.table.tableName;
    this.tableArn = this.table.tableArn;

    // Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'Projects DynamoDB table name',
    });
  }

  /**
   * Grant read/write access to a Lambda function or other grantee.
   */
  grantReadWrite(grantee: cdk.aws_iam.IGrantable): cdk.aws_iam.Grant {
    return this.table.grantReadWriteData(grantee);
  }
}
