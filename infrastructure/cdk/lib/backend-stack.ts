import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

let appName: string = "demo-app";
export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const portfolioBucket = new s3.Bucket(this, `MyBucket-${appName}`, {
      versioned: true,
      websiteIndexDocument: "index.html"
    });

    portfolioBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [portfolioBucket.arnForObjects('*')],
      principals: [new iam.AnyPrincipal()],
    }));

    new cdk.CfnOutput(this, "BucketName", {
      value: portfolioBucket.bucketName,
    });
  }
}
