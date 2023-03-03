import {
  InterfaceVpcEndpoint, InterfaceVpcEndpointAwsService, InterfaceVpcEndpointOptions, IVpc,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export default function privateEndpoint(
  construct: Construct,
  name: string,
  vpc: IVpc,
  service: InterfaceVpcEndpointAwsService,
  options: Partial<InterfaceVpcEndpointOptions> = {},
): string[] {
  // https://docs.aws.amazon.com/vpc/latest/privatelink/create-interface-endpoint.html#create-interface-endpoint-aws
  // By default all vpc traffic will be allowed to the enpoint and private DNS will be enabled
  // You can pass o[ptions if you want to modify the default behaviour
  // Typically you'll want to set up an endpoint to avoing going via the Internet and needing a NAT gateway,
  // so the default behaviour is usually fine.
  const endpoint = new InterfaceVpcEndpoint(construct, name, {
    vpc,
    service,
    ...options,
  }); // This has the Private DNS Name 'secretsmanager.eu-west-2.amazonaws.com' but we hardcode it
  return endpoint.vpcEndpointDnsEntries;
}
