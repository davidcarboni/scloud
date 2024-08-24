import { Function, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { ZipFunction, ZipFunctionProps } from './ZipFunction';
import { ContainerFunction, ContainerFunctionProps } from './ContainerFunction';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

// Based on: https://edwinradtke.com/eventtargets

/**
 *
 */
export interface DynamoDbStreamFunctionProps {
  table: Table;
  lambda: Function,
  description?: string,
  /** Filters are easier to create correctly using FilterCriteria and FilterRule. See: https://stackoverflow.com/a/70366319/723506 */
  filters?: { [key: string]: unknown; }[];
}

/**
 * A Lambda function triggered by scheduled Cloudwatch events.
 *
 * The default schedule is Schedule.cron({ minute: '11', hour: '1' })
 * Which sets '11 1 * * ? *' (i.e. 1:11am every day)
 *
 * You can also pass an optional description for readability in the Cloudwatch view in the AWS console.
 */
export class DynamoDbStreamFunction extends Construct {
  lambda: Function;

  table: Table;

  constructor(
    scope: Construct,
    id: string,
    props: DynamoDbStreamFunctionProps,
  ) {
    super(scope, `${id}DynamoDbStreamFunction`);

    this.lambda = props.lambda;
    this.table = props.table;

    this.table.grantStreamRead(this.lambda);
    this.lambda.addEventSource(new DynamoEventSource(this.table, {
      startingPosition: StartingPosition.LATEST,
      reportBatchItemFailures: true,
      filters: props.filters,
    }));
  }

  static node(
    scope: Construct,
    id: string,
    table: Table,
    functionProps?: ZipFunctionProps,
    filters?: { [key: string]: unknown; }[],
    description: string | undefined = undefined,
  ): DynamoDbStreamFunction {
    const lambda = ZipFunction.node(scope, id, functionProps);
    return new DynamoDbStreamFunction(scope, id, { lambda, table, filters, description });
  }

  static python(
    scope: Construct,
    id: string,
    table: Table,
    functionProps?: ZipFunctionProps,
    filters?: { [key: string]: unknown; }[],
    description: string | undefined = undefined,
  ): DynamoDbStreamFunction {
    const lambda = ZipFunction.python(scope, id, functionProps);
    return new DynamoDbStreamFunction(scope, id, { lambda, table, filters, description });
  }

  static container(
    scope: Construct,
    id: string,
    table: Table,
    functionProps?: ContainerFunctionProps,
    filters?: { [key: string]: unknown; }[],
    description: string | undefined = undefined,
  ): DynamoDbStreamFunction {
    const lambda = new ContainerFunction(scope, id, functionProps);
    return new DynamoDbStreamFunction(scope, id, { lambda, table, filters, description });
  }
}
