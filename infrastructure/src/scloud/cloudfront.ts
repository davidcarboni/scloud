import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53patterns from 'aws-cdk-lib/aws-route53-patterns';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { DnsValidatedCertificate, ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RestApiOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import {
  AllowedMethods, CachePolicy, Distribution,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';
import _ from 'lodash';
import { zipFunction } from './lambdaFunction';

function output(
  construct: Construct,
  type: string,
  name: string,
  value: string,
) {
  const outputName = `${_.lowerFirst(name)}${_.capitalize(type)}`;
  new CfnOutput(construct, outputName, { value });
}

export function redirectWww(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
  certificate?: ICertificate,
) {
  new route53patterns.HttpsRedirect(construct, `${name}WwwRedirect`, {
    targetDomain: zone.zoneName,
    recordNames: [`www.${zone.zoneName}`],
    zone,
    certificate: certificate || new acm.DnsValidatedCertificate(construct, `${name}WwwCertificate`, {
      domainName: `www.${zone.zoneName}`,
      hostedZone: zone,
      // this is required for Cloudfront certificates:
      // https://docs.aws.amazon.com/cdk/api/v1/docs/aws-cloudfront-readme.html
      region: 'us-east-1',
    }),
  });
}

export function webApp(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
  environment?: { [key: string]: string; },
  memory: number = 2048,
): { lambda: Function, api: LambdaRestApi, bucket: Bucket, distribution: Distribution; } {
  const domainName = `${zone.zoneName}`;

  // Web app handler
  const lambda = zipFunction(construct, name, environment, memory);

  // const headerFilter = edgeFunction(construct, 'headerFilter');

  // Static content
  const bucket = new Bucket(construct, `${name}Static`, {
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    publicReadAccess: true,
  });
  output(construct, 'StaticBucket', name, bucket.bucketName);

  const api = new LambdaRestApi(construct, `${name}ApiGateway`, {
    handler: lambda,
    proxy: true,
    binaryMediaTypes: ['multipart/form-data'],
  });

  const staticBehavior = {
    origin: new S3Origin(bucket),
    allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    compress: true,
  };

  const certificate = new DnsValidatedCertificate(construct, `${name}Certificate`, {
    domainName,
    subjectAlternativeNames: [`www.${domainName}`],
    hostedZone: zone,
    region: 'us-east-1',
  });

  const distribution = new Distribution(construct, `${name}Distribution`, {
    domainNames: [domainName],
    comment: domainName,
    defaultBehavior: {
      origin: new RestApiOrigin(api),
      //   , {
      //   customHeaders: { host: '' },
      // }),
      allowedMethods: AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      compress: true,
      cachePolicy: CachePolicy.CACHING_DISABLED,
      // https://stackoverflow.com/questions/71367982/cloudfront-gives-403-when-origin-request-policy-include-all-headers-querystri
      // OriginRequestHeaderBehavior.all() gives an error so just cookie, user-agent, referer
      originRequestPolicy: new OriginRequestPolicy(construct, `${name}OriginRequestPolicy`, {
        headerBehavior: OriginRequestHeaderBehavior.allowList('user-agent', 'User-Agent', 'Referer', 'referer'),
        cookieBehavior: OriginRequestCookieBehavior.all(),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
      }),
      // originRequestPolicy: OriginRequestPolicy.USER_AGENT_REFERER_HEADERS,
      // edgeLambdas: [{
      //   functionVersion: headerFilter.currentVersion,
      //   eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
      // }],
    },
    additionalBehaviors: {
      '/public/*': staticBehavior,
      // inxex.html direct from s3 for latency on / route? // '/': staticBehaviour'
    },
    certificate,
  });
  output(construct, 'DistributionId', name, distribution.distributionId);

  new route53.ARecord(construct, `${name}ARecord`, {
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    zone,
  });
  redirectWww(construct, name, zone, certificate);

  return {
    lambda, api, bucket, distribution,
  };
}

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
  });
  new CfnOutput(construct, `${name}Bucket`, { value: bucket.bucketName });

  const domainName = `${name}.${zone.zoneName}`;
  const distribution = new cloudfront.Distribution(construct, `${name}Distribution`, {
    domainNames: [domainName],
    comment: name,
    defaultBehavior: {
      origin: new origins.S3Origin(bucket),
      allowedMethods: AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      compress: true,
    },
    certificate: new acm.DnsValidatedCertificate(construct, `${name}Certificate`, {
      domainName,
      hostedZone: zone,
      region: 'us-east-1',
    }),
  });
  new CfnOutput(construct, `${name}DistributionId`, { value: distribution.distributionId });

  new route53.ARecord(construct, `${name}ARecord`, {
    zone,
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
  });

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
