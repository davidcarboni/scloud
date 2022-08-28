import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway, CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { RestApiOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AllowedMethods, Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import _ from 'lodash';
import { containerFunction, zipFunction } from './lambdaFunction';
import { redirectWww } from './cloudfront';

function output(
  construct: Construct,
  type: string,
  name: string,
  value: string,
) {
  const outputName = `${_.capitalize(name)}${_.capitalize(type)}`;
  new CfnOutput(construct, outputName, { value });
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

  // Static content
  const bucket = new Bucket(construct, `${name}Static`, {
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    publicReadAccess: true,
  });
  output(construct, 'Static', name, bucket.bucketName);

  const api = new apigateway.LambdaRestApi(construct, `${name}ApiGateway`, {
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

  const distribution = new Distribution(construct, `${name}Distribution`, {
    domainNames: [domainName],
    comment: domainName,
    defaultBehavior: {
      origin: new RestApiOrigin(api),
      allowedMethods: AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      compress: true,
    },
    additionalBehaviors: {
      '/public/': staticBehavior,
      // inxex.html direct from s3 for latency on / route? // '/': staticBehaviour'
    },
    certificate: new DnsValidatedCertificate(construct, `${name}Certificate`, {
      domainName,
      hostedZone: zone,
      region: 'us-east-1',
    }),
  });
  output(construct, 'DistributionId', name, distribution.distributionId);

  new route53.ARecord(construct, `${name}ARecord`, {
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    zone,
  });
  redirectWww(construct, name, zone);

  return {
    lambda, api, bucket, distribution,
  };
}

/**
 * An API gateway backed by a Lambda function.
 * @param construct Parent CDK construct (typically 'this')
 * @param initialPass If the infrastructure is being built from scratch: true;
 * for incremental deployments: false
 * @param name The name for this gateway and associated resources
 * @param zone DNS zone to use for this API
 * @param environment Environment variables for the backing Lambda function
 * @param apiDomainName Domain name to use for this API. Defaults to `api.${zone.zoneName}`
 * @returns
 */
export function apiGateway(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
  environment?: { [key: string]: string; },
  apiDomainName?: string,
  memory: number = 128,
): { lambda: Function, api: LambdaRestApi; } {
  const domainName = apiDomainName || `api.${zone.zoneName}`;

  const lambda = zipFunction(construct, name, environment, memory);

  const api = new apigateway.LambdaRestApi(construct, `${name}ApiGateway`, {
    handler: lambda,
    proxy: true,
    binaryMediaTypes: ['multipart/form-data'],
    domainName: {
      domainName,
      certificate: new DnsValidatedCertificate(construct, `${name}Certificate`, {
        domainName,
        hostedZone: zone,
      }),
    },
  });

  // DNS record
  new route53.ARecord(construct, `${name}ARecord`, {
    zone,
    recordName: domainName,
    target: RecordTarget.fromAlias(new ApiGateway(api)),
    comment: `A record for API gateway ${name} API gateway`,
  });

  return { lambda, api };
}

/**
 * An API gateway backed by a Lambda function.
 * @param construct Parent CDK construct (typically 'this')
 * @param initialPass If the infrastructure is being built from scratch: true;
 * for incremental deployments: false
 * @param name The name for this gateway and associated resources
 * @param zone DNS zone to use for this API
 * @param environment Environment variables for the backing Lambda function
 * @param domainName Domain name to use for this API. Defaults to `api.${zone.zoneName}`
 * @returns
 */
export function apiGatewayContainer(
  construct: Construct,
  initialPass: boolean,
  name: string,
  zone: route53.IHostedZone,
  environment?: { [key: string]: string; },
  apiDomainName?: string,
): { lambda: Function, repository: Repository, api: LambdaRestApi; } {
  const domainName = apiDomainName || `api.${zone.zoneName}`;

  const { lambda, repository } = containerFunction(construct, initialPass, name, environment);

  const api = new apigateway.LambdaRestApi(construct, `${name}ApiGateway`, {
    handler: lambda,
    proxy: true,
    domainName: {
      domainName,
      certificate: new DnsValidatedCertificate(construct, `${name}Certificate`, {
        domainName,
        hostedZone: zone,
      }),
    },
  });

  // DNS record
  new route53.ARecord(construct, `${name}ARecord`, {
    zone,
    recordName: domainName,
    target: RecordTarget.fromAlias(new ApiGateway(api)),
    comment: `A record for API gateway ${name} API gateway`,
  });

  return { lambda, repository, api };
}
