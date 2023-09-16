import { Construct } from 'constructs';
import {
  DockerImageFunctionProps, Function, FunctionProps, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { ZipFunction } from './ZipFunction';
import { ContainerFunction } from './ContainerFunction';

/**
 * An API gateway backed by a Lambda function.
 *
 * @param lambda The function which will respond to incoming API request events.
 * @param zone The DNS zone for this web app. By default the domain name is set to 'api.zoneName'
 * The type IHostedZone enables lookup of the zone (IHostedZone) as well as a zone creatd in the stack (HostedZone)
 * @param domain Optional: by default the domain name will be 'api.zoneName' (e.g. 'api.example.com') but you can specify a different domain here (e.g. 'subdomain.example.com').
 */
export class ApiLambda extends Construct {
  api: LambdaRestApi;

  lambda: Function;

  constructor(
    scope: Construct,
    id: string,
    lambda: Function,
    zone: IHostedZone,
    domain?: string,
  ) {
    super(scope, `${id}ApiLambda`);

    // Domain name, default to api.zoneName:
    const domainName = domain || `api.${zone.zoneName}`;

    this.lambda = lambda;

    this.api = new LambdaRestApi(scope, `${id}ApiGateway`, {
      handler: lambda,
      proxy: true,
      description: id,
      domainName: {
        domainName,
        certificate: new DnsValidatedCertificate(scope, `${id}Certificate`, {
          domainName,
          hostedZone: zone,
        }),
      },
    });

    // DNS record
    new ARecord(scope, `${id}ARecord`, {
      zone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new ApiGateway(this.api)),
      comment: `${id} API gateway`,
    });
  }

  static typescript(
    scope: Construct,
    id: string,
    zone: IHostedZone,
    domain?: string,
    environment?: { [key: string]: string; },
    functionProps?: Partial<FunctionProps>,
  ): ApiLambda {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.NODEJS_18_X, ...functionProps });
    return new ApiLambda(scope, id, lambda, zone, domain);
  }

  static python(
    scope: Construct,
    id: string,
    zone: IHostedZone,
    domain?: string,
    environment?: { [key: string]: string; },
    functionProps?: Partial<FunctionProps>,
  ): ApiLambda {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.PYTHON_3_10, ...functionProps });
    return new ApiLambda(scope, id, lambda, zone, domain);
  }

  static container(
    scope: Construct,
    id: string,
    zone: IHostedZone,
    domain?: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<DockerImageFunctionProps>,
    tagOrDigest?: string,
    ecr?: Repository,
    initialPass: boolean = false,
  ): ApiLambda {
    const lambda = new ContainerFunction(scope, id, environment, lambdaProps, tagOrDigest, ecr, initialPass);
    return new ApiLambda(scope, id, lambda, zone, domain);
  }
}
