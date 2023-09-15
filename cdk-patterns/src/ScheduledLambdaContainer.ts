import { DockerImageFunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { ContainerFunction } from './ContainerFunction';

// Based on: https://edwinradtke.com/eventtargets

/**
 * A container Lambda function triggered by scheduled Cloudwatch events.
 *
 * The default schedule isSchedule.cron({ minute: '11', hour: '1' })
 * Which sets '11 1 * * ? *' (i.e. 1:11am every day)
 */
export class ScheduledLambdaContainer extends Construct {
  function: ContainerFunction;

  rule: Rule;

  constructor(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<DockerImageFunctionProps>,
    tagOrDigest?: string,
    ecr?: Repository,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
    initialPass: boolean = false,
  ) {
    super(scope, `${id}ScheduledLambdaContainer`);

    this.function = new ContainerFunction(scope, id, environment, { ...lambdaProps }, tagOrDigest, ecr, initialPass);

    this.rule = new Rule(scope, `${id}Rule`, {
      schedule,
      targets: [new LambdaFunction(this.function)],
    });
  }
}
