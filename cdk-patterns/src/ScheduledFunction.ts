import {
  DockerImageFunctionProps, Function, FunctionProps, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { ZipFunction } from './ZipFunction';
import { ContainerFunction } from './ContainerFunction';

// Based on: https://edwinradtke.com/eventtargets

/**
 * A Lambda function triggered by scheduled Cloudwatch events.
 *
 * The default schedule isSchedule.cron({ minute: '11', hour: '1' })
 * Which sets '11 1 * * ? *' (i.e. 1:11am every day)
 *
 * You can also pass an optional description for the rule for readability in the Cloudwatch view in the AWS console.
 */
export class ScheduledLambda extends Construct {
  lambda: Function;

  rule: Rule;

  constructor(
    scope: Construct,
    id: string,
    lambda: Function,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
    description: string | undefined = undefined,
  ) {
    super(scope, `${id}ScheduledLambda`);

    this.lambda = lambda;

    this.rule = new Rule(scope, `${id}Trigger`, {
      schedule,
      targets: [new LambdaFunction(this.lambda)],
      description,
    });
  }

  static node(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    functionProps?: Partial<FunctionProps>,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
    description: string | undefined = undefined,
  ): ScheduledLambda {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.NODEJS_18_X, ...functionProps });
    return new ScheduledLambda(scope, id, lambda, schedule, description);
  }

  static python(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    functionProps?: Partial<FunctionProps>,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
    description: string | undefined = undefined,
  ): ScheduledLambda {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.PYTHON_3_10, ...functionProps });
    return new ScheduledLambda(scope, id, lambda, schedule, description);
  }

  static container(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<DockerImageFunctionProps>,
    tagOrDigest?: string,
    ecr?: Repository,
    initialPass: boolean = false,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
    description: string | undefined = undefined,
  ): ScheduledLambda {
    const lambda = new ContainerFunction(scope, id, environment, lambdaProps, tagOrDigest, ecr, initialPass);
    return new ScheduledLambda(scope, id, lambda, schedule, description);
  }
}
