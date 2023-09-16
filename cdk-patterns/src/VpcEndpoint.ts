import {
  InterfaceVpcEndpoint, InterfaceVpcEndpointAwsService, InterfaceVpcEndpointOptions, IVpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Enable private access to AWS services using VPC endpoints.
 *
 * This avoids the need for a NAT gateway if for example you need to run a Fargase service in
 * a private subnet and it doesn't have internet access to pull the container from the public ECR enfpoint.
 *
 * THis Construct includes static methids for common services, but you can use the constructor to create different endpoints:
 * - s3
 * - sqs
 * - ecr
 * - ecrDocker
 * - secretsManager
 * - cloudwatch
 *
 * https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html#create-interface-endpoint-aws
 * By default all vpc traffic will be allowed to the enpoint and private DNS will be enabled
 * You can pass o[ptions if you want to modify the default behaviour
 * Typically you'll want to set up an endpoint to avoing going via the Internet and needing a NAT gateway,
 * so the default behaviour is usually fine.
 */
export class PrivateEndpoint extends InterfaceVpcEndpoint {
  constructor(
    scope: Construct,
    id: string,
    vpc: IVpc,
    service: InterfaceVpcEndpointAwsService,
    options: Partial<InterfaceVpcEndpointOptions> = {},
  ) {
    super(scope, id, {
      vpc,
      service,
      ...options,
    });
  }

  static s3(
    scope: Construct,
    id: string,
    vpc: IVpc,
    options: Partial<InterfaceVpcEndpointOptions> = {},
  ) {
    return new PrivateEndpoint(scope, id, vpc, InterfaceVpcEndpointAwsService.S3, options);
  }

  static sqs(
    scope: Construct,
    id: string,
    vpc: IVpc,
    options: Partial<InterfaceVpcEndpointOptions> = {},
  ) {
    return new PrivateEndpoint(scope, id, vpc, InterfaceVpcEndpointAwsService.SQS, options);
  }

  static ecr(
    scope: Construct,
    id: string,
    vpc: IVpc,
    options: Partial<InterfaceVpcEndpointOptions> = {},
  ) {
    return new PrivateEndpoint(scope, id, vpc, InterfaceVpcEndpointAwsService.ECR, options);
  }

  static ecrDocker(
    scope: Construct,
    id: string,
    vpc: IVpc,
    options: Partial<InterfaceVpcEndpointOptions> = {},
  ) {
    return new PrivateEndpoint(scope, id, vpc, InterfaceVpcEndpointAwsService.ECR_DOCKER, options);
  }

  static secretsManager(
    scope: Construct,
    id: string,
    vpc: IVpc,
    options: Partial<InterfaceVpcEndpointOptions> = {},
  ) {
    return new PrivateEndpoint(scope, id, vpc, InterfaceVpcEndpointAwsService.SECRETS_MANAGER, options);
  }

  static cloudwatch(
    scope: Construct,
    id: string,
    vpc: IVpc,
    options: Partial<InterfaceVpcEndpointOptions> = {},
  ) {
    return new PrivateEndpoint(scope, id, vpc, InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS, options);
  }
}
