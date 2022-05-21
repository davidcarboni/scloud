import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { containerFunction, zipFunction } from './lambdaFunction';

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
export function apiGateway(
  construct: Construct,
  initialPass: boolean,
  name: string,
  zone: route53.IHostedZone,
  environment?: { [key: string]: string; },
  apiDomainName?: string,
): { lambda: Function, api: LambdaRestApi; } {
  const domainName = apiDomainName || `${name}.${zone.zoneName}`;

  const lambda = zipFunction(construct, name, environment);

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
