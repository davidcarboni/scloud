import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53patterns from 'aws-cdk-lib/aws-route53-patterns';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import {
  AllowedMethods, Distribution, ViewerProtocolPolicy, // LambdaEdgeEventType,
} from 'aws-cdk-lib/aws-cloudfront';
// import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
// import * as lambda from './lambdaFunction';

/**
 * A Cloudfront distribution backed by an s3 bucket.
 * NB us-east-1 is required for Cloudfront certificates:
 * https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
 * @param construct Parent CDK construct (typically 'this')
 * @param name The name for this gateway and associated resources
 * @param zone DNS zone to use for this API
 * @param initialPass If the infrastructure is being built from scratch: true;
 * for incremental deployments: false
 * @param environment Environment variables for the backing Lambda function
 * @returns The static website bucket
 */
export function cloudFront(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
  wwwRedirect: boolean = true,
  // initialPass: boolean,
  // environment?: { [key: string]: string; },
  // apiDomain?: string,
): {
  bucket: Bucket,
  distribution: Distribution,
  // lambda?: IFunction;
} {
  // Default: Cloudfont -> bucket on domain name
  const bucket = new s3.Bucket(construct, `${name}`, {
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    publicReadAccess: true,
    websiteIndexDocument: 'index.html',
    websiteErrorDocument: '404.html',
  });
  new CfnOutput(construct, `${name}Bucket`, { value: bucket.bucketName });

  // Edge function for rendering templates
  // const edgeLambdas = [];
  // const edgeFunction = lambda.edgeFunction(construct, name);
  // edgeLambdas.push({
  //   functionVersion: edgeFunction.currentVersion,
  //   eventType: LambdaEdgeEventType.VIEWER_REQUEST,
  //   includeBody: true,
  // });

  const domainName = `${name}.${zone.zoneName}`;
  const distribution = new cloudfront.Distribution(construct, `${name}Distribution`, {
    domainNames: [domainName],
    comment: name,
    defaultBehavior: {
      origin: new origins.S3Origin(bucket),
      allowedMethods: AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      compress: true,
      // edgeLambdas,
    },
    //   additionalBehaviors: {
    //     // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesPathPattern
    //     '*.*': { // Static content files that have a fle extension, including subdirectories
    //       origin: new origins.S3Origin(bucket),
    //       allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    //       viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    //       compress: true,
    //     },
    //   },
    certificate: new acm.DnsValidatedCertificate(construct, `${name}Certificate`, {
      domainName,
      hostedZone: zone,
      region: 'us-east-1',
    }),
  });

  new route53.ARecord(construct, `${name}ARecord`, {
    zone,
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
  });
  // Do we really need this?
  // route53patterns.HttpsRedirect (below) generates one, so added here for consistency
  // new route53.AaaaRecord(construct, `${name}AaaaRecord`, {
  //   zone,
  //   target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
  // });

  // Redirect www -> zone root
  if (wwwRedirect) {
    new route53patterns.HttpsRedirect(construct, `${name}WwwRedirect`, {
      recordNames: [`www.${domainName}`],
      targetDomain: domainName,
      zone,
      certificate: new acm.DnsValidatedCertificate(construct, `${name}CertificateWww`, {
        domainName: `www.${domainName}`,
        hostedZone: zone,
        region: 'us-east-1',
      }),
    });
  }

  return {
    bucket, distribution, // lambda: edgeFunction?.lambda,
  };
}

export function redirect(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
  targetDomain: string,
) {
  new route53patterns.HttpsRedirect(construct, `${name}Redirect`, {
    targetDomain,
    recordNames: [zone.zoneName, `www.${zone.zoneName}`],
    zone,
    certificate: new acm.DnsValidatedCertificate(construct, `${name}Certificate`, {
      domainName: zone.zoneName,
      subjectAlternativeNames: [`www.${zone.zoneName}`],
      hostedZone: zone,
      // this is required for Cloudfront certificates:
      // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
      region: 'us-east-1',
    }),
  });
}

export function redirectWww(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
) {
  new route53patterns.HttpsRedirect(construct, `${name}WwwRedirect`, {
    targetDomain: zone.zoneName,
    recordNames: [`www.${zone.zoneName}`],
    zone,
    certificate: new acm.DnsValidatedCertificate(construct, `${name}WwwCertificate`, {
      domainName: `www.${zone.zoneName}`,
      hostedZone: zone,
      // this is required for Cloudfront certificates:
      // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
      region: 'us-east-1',
    }),
  });
}

// Update edge lambda: https://stackoverflow.com/questions/50967018/awscli-lambda-function-update-trigger
