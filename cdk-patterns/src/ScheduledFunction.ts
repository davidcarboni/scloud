import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { ZipFunction, ZipFunctionProps } from './ZipFunction';
import { ContainerFunction, ContainerFunctionProps } from './ContainerFunction';

// Based on: https://edwinradtke.com/eventtargets

/**
 *
 */
export interface ScheduledFunctionProps {
  lambda: Function,
  schedule: Schedule,
  description?: string,
}

/**
 * A Lambda function triggered by scheduled Cloudwatch events.
 *
 * The default schedule is Schedule.cron({ minute: '11', hour: '1' })
 * Which sets '11 1 * * ? *' (i.e. 1:11am every day)
 *
 * You can also pass an optional description for the rule for readability in the Cloudwatch view in the AWS console.
 */
export class ScheduledFunction extends Construct {
  lambda: Function;

  rule: Rule;

  constructor(
    scope: Construct,
    id: string,
    props: ScheduledFunctionProps,
  ) {
    super(scope, `${id}ScheduledFunction`);

    this.lambda = props.lambda;

    this.rule = new Rule(scope, `${id}Trigger`, {
      schedule: props.schedule || Schedule.cron({ minute: '11', hour: '1' }),
      targets: [new LambdaFunction(props.lambda)],
      description: props.description,
    });
  }

  static node(
    scope: Construct,
    id: string,
    functionProps?: ZipFunctionProps,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
    description: string | undefined = undefined,
  ): ScheduledFunction {
    const lambda = ZipFunction.node(scope, id, functionProps);
    return new ScheduledFunction(scope, id, { lambda, schedule, description });
  }

  static python(
    scope: Construct,
    id: string,
    functionProps?: ZipFunctionProps,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
    description: string | undefined = undefined,
  ): ScheduledFunction {
    const lambda = ZipFunction.python(scope, id, functionProps);
    return new ScheduledFunction(scope, id, { lambda, schedule, description });
  }

  static container(
    scope: Construct,
    id: string,
    functionProps?: ContainerFunctionProps,
    schedule: Schedule = Schedule.cron({ minute: '11', hour: '1' }),
    description: string | undefined = undefined,
  ): ScheduledFunction {
    const lambda = new ContainerFunction(scope, id, functionProps);
    return new ScheduledFunction(scope, id, { lambda, schedule, description });
  }
}
