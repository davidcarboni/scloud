import { Construct } from 'constructs';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { ZipFunction, ZipFunctionProps } from './ZipFunction';
import { ContainerFunction, ContainerFunctionProps } from './ContainerFunction';

/**
 * @param lambda The Lambda function to be triggered by the bucket. This will be generated for you if you use one of the static methods (node, python, container)
 * @param zone Optional: a DNS zone for this API. By default the domain name is set to 'api.<zoneName>'
 * @param domain Optional: If you want to specify a domain name that differs from the default 'api.<zoneName>' (e.g. 'subdomain.example.com') you can do so here
 */
export interface ApiFunctionProps {
  lambda: Function,
  zone?: IHostedZone,
  domain?: string,
}

/**
 * An API gateway backed by a Lambda function.
 */
export class ApiFunction extends Construct {
  lambda: Function;

  api: LambdaRestApi;

  apiGateway: ApiGateway;

  constructor(
    scope: Construct,
    id: string,
    props: ApiFunctionProps,
  ) {
    super(scope, `${id}ApiFunction`);

    // Domain name and SSL certificate (default to api.<zoneName>):
    const name = props.domain || `api.${props.zone?.zoneName}`;
    let domainName: any | undefined;
    if (props.zone) {
      domainName = props.zone ? {
        domainName: name,
        certificate: new DnsValidatedCertificate(scope, `${id}Certificate`, {
          domainName: name,
          hostedZone: props.zone,
        }),
      } : undefined;
    }

    this.lambda = props.lambda;

    this.api = new LambdaRestApi(scope, `${id}ApiGateway`, {
      handler: props.lambda,
      proxy: true,
      description: id,
      domainName,
    });

    this.apiGateway = new ApiGateway(this.api);

    // DNS record
    if (props.zone) {
      new ARecord(scope, `${id}ARecord`, {
        zone: props.zone,
        recordName: name,
        target: RecordTarget.fromAlias(this.apiGateway),
        comment: `${id} API gateway`,
      });
    }
  }

  static node(
    scope: Construct,
    id: string,
    functionProps?: ZipFunctionProps,
    zone?: IHostedZone,
    domain?: string,
  ): ApiFunction {
    const lambda = ZipFunction.node(scope, id, functionProps);
    return new ApiFunction(scope, id, { lambda, zone, domain });
  }

  static python(
    scope: Construct,
    id: string,
    functionProps?: ZipFunctionProps,
    zone?: IHostedZone,
    domain?: string,
  ): ApiFunction {
    const lambda = ZipFunction.python(scope, id, functionProps);
    return new ApiFunction(scope, id, { lambda, zone, domain });
  }

  static container(
    scope: Construct,
    id: string,
    functionProps?: ContainerFunctionProps,
    zone?: IHostedZone,
    domain?: string,
  ): ApiFunction {
    const lambda = new ContainerFunction(scope, id, functionProps);
    return new ApiFunction(scope, id, { lambda, zone, domain });
  }
}
