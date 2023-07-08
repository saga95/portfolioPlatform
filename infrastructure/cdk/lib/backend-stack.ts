import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

let appName: string = "demo-app";
export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const portfolioBucket = new s3.Bucket(this, `MyBucket-${appName}`, {
      versioned: true,
    });
    
    new cdk.CfnOutput(this, "BucketName", {
      value: portfolioBucket.bucketName,
    });
  }
}
