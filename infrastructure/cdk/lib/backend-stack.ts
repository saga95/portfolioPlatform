import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { BucketWebsiteTarget } from "aws-cdk-lib/aws-route53-targets";
let appName: string = "demo-app";
export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const portfolioBucket = new s3.Bucket(this, `MyBucket-${appName}`, {
      versioned: true,
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
    });

    new cdk.CfnOutput(this, "BucketName", {
      value: portfolioBucket.bucketName,
    });

    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: 'sagara.me' });

    new ARecord(this, "SiteAliasRecord", {
      recordName: "www",
      target: RecordTarget.fromAlias(new BucketWebsiteTarget(portfolioBucket)),
      zone
    })

  }
}
