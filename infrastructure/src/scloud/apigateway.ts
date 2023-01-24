import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway, CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import {
  AllowedMethods, CachePolicy, Distribution, OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior, OriginRequestPolicy, OriginRequestQueryStringBehavior, ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { RestApiOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { containerFunction, zipFunctionTypescript } from './lambdaFunction';

export function cloudfrontApiGateway(
  construct: Construct,
  name: string,
  zone: route53.IHostedZone,
  environment?: { [key: string]: string; },
  domain?: string,
  memory: number = 256,
  routes: string[] = ['/'],
): { lambda: Function, distribution: Distribution; } {
  const domainName = domain || `${zone.zoneName}`;

  const lambda = zipFunctionTypescript(construct, name, environment, { memorySize: memory });

  // Cloudfromt distribution
  const distribution = new Distribution(construct, `${name}Distribution`, {
    domainNames: [domainName],
    comment: domainName,
    defaultBehavior: {
      // Request bin: default is to deflect all requests that aren't known to the API - mostly scripts probing for Wordpress installations
      origin: new S3Origin(new Bucket(construct, `${name}RequestBin`, {
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        publicReadAccess: true,
      })),
      allowedMethods: AllowedMethods.ALLOW_ALL,
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: CachePolicy.CACHING_OPTIMIZED,
      originRequestPolicy: new OriginRequestPolicy(construct, `${name}BinOriginRequestPolicy`, {
        headerBehavior: OriginRequestHeaderBehavior.allowList('user-agent', 'User-Agent', 'Referer', 'referer', 'Bearer', 'bearer'),
        cookieBehavior: OriginRequestCookieBehavior.all(),
        queryStringBehavior: OriginRequestQueryStringBehavior.all(),
      }),
    },
    certificate: new DnsValidatedCertificate(construct, `${name}Certificate`, {
      domainName,
      hostedZone: zone,
      region: 'us-east-1',
    }),
  });

  // Handle API requests
  const apiOrigin = new RestApiOrigin(new apigateway.LambdaRestApi(construct, `${name}Api`, {
    handler: lambda,
    proxy: true,
    description: name,
  }));
  const apiOptions = {
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
  };
  routes.forEach((path) => distribution.addBehavior(path, apiOrigin, apiOptions));

  new route53.ARecord(construct, `${name}ARecord`, {
    recordName: domainName,
    target: route53.RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    zone,
  });

  return { lambda, distribution };
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

  const lambda = zipFunctionTypescript(construct, name, environment, { memorySize: memory });

  const api = new apigateway.LambdaRestApi(construct, `${name}ApiGateway`, {
    handler: lambda,
    proxy: true,
    description: name,
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
): { lambda: Function, api: LambdaRestApi, repository: Repository; } {
  const domainName = apiDomainName || `api.${zone.zoneName}`;

  const { lambda, repository } = containerFunction(construct, initialPass, name, environment);

  const api = new apigateway.LambdaRestApi(construct, `${name}ApiGateway`, {
    handler: lambda,
    proxy: true,
    description: name,
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

  return { lambda, api, repository };
}
