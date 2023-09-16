import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { CfnService, ContainerImage, LogDrivers } from 'aws-cdk-lib/aws-ecs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EcrRepository } from './EcrRepository';

/**
 * Builds an ApplicationLoadBalancedFargateService that runs a container on ECS Fargate.
 *
 * Warning! This pattern is not 'pure' serverless! It gennerates 24x7 running costs per container (rather than being billed on traffic/storage).
 *
 * Warning! If you don't pass a vpc, this construct creates a vpc for you and limits the nuber of NAT gateways to 1 to reduce cost. This is less resilient, but NAT gateways are costly!
 *
 * If you'd like to avoid this tradeoof, pass in a vpc you've createed that ha zero NAT gateways and is configured with PrivateEndpoint(s) that will allow ECS to pull container images.
 *
 * @param serviceName Name for the service
 * @param zone DNS zone
 * @param domain Optional: by default the zone name will be used as the DNS name for the service (e.g. 'example.com') but you can specify a different domain here (e.g. 'subdomain.example.com').
 * @param environment Any environment variables for the container
 * @param repository Optional: if you want to use an existing container image repository
 * @param tag Optional: defaults to 'latest'
 * @param vpc Optional: if you want to use an existing VPC. In not set, a vpc will be created for you
 * @param cpu Optional: defaults to 512
 * @param memory Optional: defaults to 1024
 * @param taskCount Optional: defaults to 2 for redundancy. Set to 1 if you want to reduce cost.
 * @param zeroTasks Sets task count to zero. Pass true if you don't have an image in ECR yet, otherwise this construct will fail to build.
 * @param containerPort Optional: defaults to 3000. This is the port the application in your container listens on.
 * @returns Deplyment detais
 */
export class FargateService extends Construct {
  certificate: DnsValidatedCertificate;

  repository: Repository;

  albFargateService: ApplicationLoadBalancedFargateService;

  vpc: Vpc;

  constructor(
    scope: Construct,
    id: string,
    serviceName: string,
    zone: IHostedZone,
    domain?: string,
    environment: { [key: string]: string; } = {},
    repository: Repository | undefined = undefined,
    tag: string = 'latest',
    vpc: Vpc | undefined = undefined,
    cpu: number = 512,
    memory: number = 1024,
    taskCount: number = 2,
    zeroTasks: boolean = false,
    containerPort: number = 3000,
  ) {
    super(scope, `${id}FargateService`);

    // Container repository
    this.repository = repository || new EcrRepository(scope, id);
    // It seems like NAT gateways are costly, so I've set this up to avoid that - only creating one.
    // At some point we may want to figure out a privte endpoint so that we can retire the NAT.
    // Based on: https://www.binarythinktank.com/blog/truly-serverless-container
    // and https://stackoverflow.com/questions/64299664/how-to-configure-aws-cdk-applicationloadbalancedfargateservice-to-log-parsed-jso
    this.vpc = vpc || new Vpc(scope, `${id}Vpc`, {
      natGateways: 1,
      subnetConfiguration: [{
        name: id,
        subnetType: SubnetType.PUBLIC,
      }],
    });

    // Fargate
    this.albFargateService = new ApplicationLoadBalancedFargateService(
      scope,
      `${id}AlbFargateService`,
      {
        loadBalancerName: id,
        serviceName,
        domainZone: zone,
        domainName: domain || zone.zoneName,
        certificate: new DnsValidatedCertificate(scope, id, {
          domainName: domain || zone.zoneName,
          hostedZone: zone,
        }),
        protocol: ApplicationProtocol.HTTPS,
        cpu,
        memoryLimitMiB: memory,
        taskImageOptions: {
          containerName: id,
          image: ContainerImage.fromEcrRepository(this.repository, tag),
          containerPort,
          environment,
          logDriver: LogDrivers.awsLogs({
            streamPrefix: id,
            logGroup: new LogGroup(scope, `${id}LogGroup`, {
              // Ensure the log group is deleted when the stack is deleted
              // and that logs aren't retained indefinitely
              logGroupName: `/${Stack.of(scope).stackName}/ecs/${id}`,
              removalPolicy: RemovalPolicy.DESTROY,
              retention: RetentionDays.THREE_MONTHS,
            }),
          }),
        },
        desiredCount: taskCount,
        vpc: this.vpc,
        // ? https://stackoverflow.com/questions/67301268/aws-fargate-resourceinitializationerror-unable-to-pull-secrets-or-registry-auth
        assignPublicIp: true,
      },
    );
    this.albFargateService.loadBalancer.addRedirect(); // http -> https

    if (zeroTasks) {
      // On the first deploy, when there's no image in the repository, setting desired tasks to zero allows this construct to build, otherwise :
      // https://github.com/aws/aws-cdk/issues/3646#issuecomment-623919242
      const { node } = this.albFargateService.service;
      const cfnService = node.findChild('Service') as CfnService;
      cfnService.desiredCount = 0;
    }
  }
}
