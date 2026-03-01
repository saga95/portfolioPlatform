import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

export interface DashboardHostingProps {
  /**
   * Environment name (dev, staging, prod).
   */
  readonly environment: 'dev' | 'staging' | 'prod';

  /**
   * Optional custom domain names for CloudFront.
   */
  readonly domainNames?: string[];

  /**
   * Optional ACM certificate ARN for custom domain (must be in us-east-1).
   */
  readonly certificateArn?: string;

  /**
   * Removal policy for the S3 bucket.
   * @default DESTROY for dev/staging, RETAIN for prod
   */
  readonly removalPolicy?: cdk.RemovalPolicy;
}

/**
 * L3 construct that provisions S3 bucket + CloudFront distribution
 * for hosting the PromptDeploy dashboard SPA.
 *
 * Features:
 * - Private S3 bucket with OAC (Origin Access Control)
 * - CloudFront with SPA routing (403/404 → /index.html)
 * - Cache-optimized: immutable assets (1yr), index.html (no-cache)
 * - Optional custom domain with ACM certificate
 */
export class DashboardHosting extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly bucketName: string;
  public readonly distributionId: string;
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: DashboardHostingProps) {
    super(scope, id);

    const isProd = props.environment === 'prod';
    const removalPolicy = props.removalPolicy
      ?? (isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY);

    // ─── S3 Bucket ──────────────────────────────────────────────────────
    this.bucket = new s3.Bucket(this, 'DashboardBucket', {
      bucketName: `promptdeploy-dashboard-${props.environment}-${cdk.Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: isProd,
      removalPolicy,
      autoDeleteObjects: !isProd,
    });

    // ─── CloudFront Distribution ────────────────────────────────────────
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);

    const distributionProps: cloudfront.DistributionProps = {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: isProd
        ? cloudfront.PriceClass.PRICE_CLASS_ALL
        : cloudfront.PriceClass.PRICE_CLASS_100,
    };

    // Add custom domain + certificate if provided
    if (props.domainNames && props.certificateArn) {
      Object.assign(distributionProps, {
        domainNames: props.domainNames,
        certificate: cdk.aws_certificatemanager.Certificate.fromCertificateArn(
          this, 'Certificate', props.certificateArn,
        ),
      });
    }

    this.distribution = new cloudfront.Distribution(
      this, 'DashboardCDN', distributionProps,
    );

    // ─── Outputs ────────────────────────────────────────────────────────
    this.bucketName = this.bucket.bucketName;
    this.distributionId = this.distribution.distributionId;
    this.distributionDomainName = this.distribution.distributionDomainName;
  }
}
