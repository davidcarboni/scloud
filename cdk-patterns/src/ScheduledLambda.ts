import { FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { ZipFunction } from './ZipFunction';

// Based on: https://edwinradtke.com/eventtargets

/**
 * A Lambda function triggered by scheduled Cloudwatch events.
 *
 * The default schedule isSchedule.cron({ minute: '11', hour: '1' })
 * Which sets '11 1 * * ? *' (i.e. 1:11am every day)
 */
export class ScheduledLambda extends Construct {
  zipFunction: ZipFunction;

  rule: Rule;

  constructor(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<FunctionProps>,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
  ) {
    super(scope, `${id}ScheduledLambda`);

    this.zipFunction = new ZipFunction(scope, id, environment, { ...lambdaProps });

    this.rule = new Rule(scope, `${id}Rule`, {
      schedule,
      targets: [new LambdaFunction(this.zipFunction)],
    });
  }
}
