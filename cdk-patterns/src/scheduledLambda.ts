import { DockerImageFunctionProps, Function, FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { containerFunction, zipFunction } from './lambdaFunction';

// Based on: https://edwinradtke.com/eventtargets

/**
 * A Lambda function triggered by scheduled Cloudwatch events.
 *
 * The default schedule isSchedule.cron({ minute: '11', hour: '1' })
 * Which sets '11 1 * * ? *' (i.e. 1:11am every day)
 */
export function bucketLambda(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
  lambdaProps?: Partial<FunctionProps>,
  schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
): { rule: Rule, lambda: Function; } {
  const lambda = zipFunction(construct, name, environment, { ...lambdaProps });

  const rule = new Rule(construct, `${name}Rule`, {
    schedule,
    targets: [new LambdaFunction(lambda)],
  });

  return {
    rule, lambda,
  };
}

/**
 * A container Lambda function triggered by scheduled Cloudwatch events.
 */
export function bucketLambdaContainer(
  construct: Construct,
  name: string,
  initialPass: boolean,
  environment?: { [key: string]: string; },
  ecr?: IRepository,
  lambdaProps?: Partial<DockerImageFunctionProps>,
  schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
): { repository: IRepository, rule: Rule, lambda: Function; } {
  const { repository, lambda } = containerFunction(construct, initialPass, name, environment, { ...lambdaProps }, 'latest', ecr);

  const rule = new Rule(construct, `${name}Rule`, {
    schedule,
    targets: [new LambdaFunction(lambda)],
  });

  return {
    repository, rule, lambda,
  };
}
