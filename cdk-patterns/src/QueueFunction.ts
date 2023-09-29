import { RemovalPolicy } from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { ZipFunction, ZipFunctionProps } from './ZipFunction';
import { ContainerFunction, ContainerFunctionProps } from './ContainerFunction';

/**
 * @param lambda The Lambda function to be triggered by the SQS queue. This will be generated for you if you use one of the static methods (node, python, container)
 * @param queueProps Optional: If you need to specify any detailed properties for the SQS Queue, you can do so here and they will override any defaults
 */
export interface QueueFunctionProps {
  lambda: Function,
  queueProps?: Partial<QueueProps>,
}

/**
 * A Lambda function triggered by SQS queue events.
 *
 * Defaults for the queue are:
 *  - visibilityTimeout: timeout from the lambdaProps or 60 seconds if not defined
 *  - encryption: QueueEncryption.KMS_MANAGED
 *  - removalPolicy: RemovalPolicy.DESTROY
 */
export class QueueFunction extends Construct {
  queue: Queue;

  lambda: Function;

  constructor(
    scope: Construct,
    id: string,
    props: QueueFunctionProps,
  ) {
    super(scope, `${id}QueueFunction`);

    // Incoming message queue
    this.queue = new Queue(scope, `${id}Queue`, {
      visibilityTimeout: props.lambda.timeout, // NB Message timeout needs to match between the queue and the lambda
      encryption: QueueEncryption.KMS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      ...props.queueProps,
    });

    props.lambda.addEventSource(new SqsEventSource(this.queue, { reportBatchItemFailures: true }));

    this.lambda = props.lambda;
  }

  static node(
    scope: Construct,
    id: string,
    functionProps?: ZipFunctionProps,
    queueProps?: Partial<QueueProps>,
  ): QueueFunction {
    const lambda = ZipFunction.node(scope, id, functionProps);
    return new QueueFunction(scope, id, { lambda, queueProps });
  }

  static python(
    scope: Construct,
    id: string,
    functionProps?: ZipFunctionProps,
    queueProps?: Partial<QueueProps>,
  ): QueueFunction {
    const lambda = ZipFunction.python(scope, id, functionProps);
    return new QueueFunction(scope, id, { lambda, queueProps });
  }

  static container(
    scope: Construct,
    id: string,
    functionProps?: ContainerFunctionProps,
    queueProps?: Partial<QueueProps>,
  ): QueueFunction {
    const lambda = new ContainerFunction(scope, id, functionProps);
    return new QueueFunction(scope, id, { lambda, queueProps });
  }
}
