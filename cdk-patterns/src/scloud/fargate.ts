import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { CfnService, ContainerImage, LogDrivers } from 'aws-cdk-lib/aws-ecs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import ecrRepository from './ecrRepository';

interface Deployment {
  repository: Repository,
  albFargateService: ApplicationLoadBalancedFargateService,
  vpc: Vpc,
 }

/**
 * Builds an ApplicationLoadBalancedFargateService
 * @param stack Parent CDK stack
 * @param name Base name for resources / resource IDs
 * @param zone DNS zone
 * @param environment Any environment variables
 * @param zeroTasks Sets task count to zero - useful if you don't have an image in ECR yet.
 * @param vpc Optional VPC to host the cluster in
 * @returns Deplyment detais
 */
export default function fargate(
  stack: Stack,
  name: string,
  serviceName: string,
  zone: IHostedZone,
  domainName?: string,
  environment: { [key: string]: string; } = {},
  repository: Repository | undefined = undefined,
  tag: string = 'latest',
  zeroTasks: boolean = false,
  vpc: Vpc | undefined = undefined,
): Deployment {
  const result: Deployment = <Deployment>{};

  // Container repository
  result.repository = repository || ecrRepository(stack, name);
  // It seems like NAT gateways are costly, so I've set this up to avoid that - only creating one.
  // At some point we may want to figure out a privte endpoint so that we can retire the NAT.
  // Based on: https://www.binarythinktank.com/blog/truly-serverless-container
  // and https://stackoverflow.com/questions/64299664/how-to-configure-aws-cdk-applicationloadbalancedfargateservice-to-log-parsed-jso
  result.vpc = vpc || new Vpc(stack, `${name}Vpc`, {
    natGateways: 1,
    subnetConfiguration: [{
      name,
      subnetType: SubnetType.PUBLIC,
    }],
  });

  // Fargate
  result.albFargateService = new ApplicationLoadBalancedFargateService(
    stack,
    `${name}AlbFargateService`,
    {
      loadBalancerName: name,
      serviceName,
      domainZone: zone,
      domainName: domainName || zone.zoneName,
      certificate: new DnsValidatedCertificate(stack, name, {
        domainName: domainName || zone.zoneName,
        hostedZone: zone,
      }),
      protocol: ApplicationProtocol.HTTPS,
      cpu: 512,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        containerName: name,
        image: ContainerImage.fromEcrRepository(result.repository, tag),
        containerPort: 3000,
        environment,
        logDriver: LogDrivers.awsLogs({
          streamPrefix: name,
          logGroup: new LogGroup(stack, `${name}LogGroup`, {
            // Ensure the log group is deleted when the stack is deleted
            // and that logs aren't retained indefinitely
            logGroupName: `/${stack.stackName}/ecs/${name}`,
            removalPolicy: RemovalPolicy.DESTROY,
            retention: RetentionDays.THREE_MONTHS,
          }),
        }),
      },
      desiredCount: 2,
      vpc: result.vpc,
      // ? https://stackoverflow.com/questions/67301268/aws-fargate-resourceinitializationerror-unable-to-pull-secrets-or-registry-auth
      assignPublicIp: true,
    },
  );
  result.albFargateService.loadBalancer.addRedirect(); // http -> https

  if (zeroTasks) {
    // On the first deploy, when there's no image in the repository:
    // https://github.com/aws/aws-cdk/issues/3646#issuecomment-623919242
    const { node } = result.albFargateService.service;
    const cfnService = node.findChild('Service') as CfnService;
    cfnService.desiredCount = 0;
  }

  return result;
}
