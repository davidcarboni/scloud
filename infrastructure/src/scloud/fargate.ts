import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { ApplicationProtocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import ecrRepository from './ecrRepository';

// https://docs.aws.amazon.com/lambda/latest/dg/services-alb.html

// let albfs: ecsPatterns.ApplicationLoadBalancedFargateService;

// new CfnOutput(this, 'clusterArn', { value: albfs.cluster.clusterArn });

// dynamoDBTable.grantReadWriteData(albfs.taskDefinition.taskRole);

// Configure the load balancer to send /auth traffic to the function
// const authTarget = new elbv2targets.LambdaTarget(
//   authFunction,
// );
// albfs.listener.addTargets('authTarget', {
//   targets: [authTarget],
//   targetGroupName: 'auth',
//   conditions: [ListenerCondition.pathPatterns(['/auth'])],
//   priority: 100,
// });

// statements.push(new iam.PolicyStatement({
//   effect: iam.Effect.ALLOW,
//   actions: [
//     'ecs:UpdateService',
//   ],
//   resources: [albfs.service.serviceArn],
// }));

/**
 * The resourcdes that make up the web applicaiton.
 */
export default function fargate(
  construct: Construct,
  name: string,
  zone: route53.HostedZone,
  initialPass: boolean,
  environment: { [key: string]: string; } = {},
): { [key: string]: string; } {
  const result: any = {};

  // Container repository
  result.repository = ecrRepository(construct, name);

  // It seems like NAT gateways are costly, so I've set this up to avoid that.
  // Based on: https://www.binarythinktank.com/blog/truly-serverless-container
  // and https://stackoverflow.com/questions/64299664/how-to-configure-aws-cdk-applicationloadbalancedfargateservice-to-log-parsed-jso
  result.vpc = new ec2.Vpc(construct, `${name}Vpc`, {
    natGateways: 0,
    subnetConfiguration: [{
      name,
      subnetType: ec2.SubnetType.PUBLIC,
    }],
  });

  result.certificate = new acm.DnsValidatedCertificate(construct, `${name}Certificate`, {
    domainName: zone.zoneName,
    subjectAlternativeNames: [`www.${zone.zoneName}`],
    hostedZone: zone,
  });

  // Fargate
  result.albFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
    construct,
    `${name}AlbFargateService`,
    {
      loadBalancerName: `${name}`,
      serviceName: name,
      protocol: ApplicationProtocol.HTTPS,
      domainZone: zone,
      domainName: zone.zoneName,
      certificate: result.certificate,
      cpu: 512,
      memoryLimitMiB: 1024,
      taskImageOptions: {
        containerName: name,
        image: ecs.ContainerImage.fromEcrRepository(result.repository),
        containerPort: 3000,
        environment,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: name,
          logGroup: new logs.LogGroup(construct, `${name}LogGroup`, {
            // Ensure the log group is deleted when the stack is deleted
            // and that logs aren't retained indefinitely
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            retention: logs.RetentionDays.ONE_MONTH,
            logGroupName: `/aws/ecs/${name}`,
          }),
        }),
      },
      desiredCount: 1,
      vpc: result.vpc,
      // ? https://stackoverflow.com/questions/67301268/aws-fargate-resourceinitializationerror-unable-to-pull-secrets-or-registry-auth
      assignPublicIp: true,
    },
  );

  if (initialPass) {
    // On the first deploy, when there's no image in the repository:
    // https://github.com/aws/aws-cdk/issues/3646#issuecomment-623919242
    const { node } = result.albFargateService.service;
    const cfnService = node.findChild('Service') as ecs.CfnService;
    cfnService.desiredCount = 0;
  }

  return result;
}
