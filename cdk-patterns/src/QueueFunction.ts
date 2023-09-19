import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  DockerImageFunctionProps, Function, FunctionProps, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { ZipFunction } from './ZipFunction';
import { ContainerFunction } from './ContainerFunction';

/**
 * A Lambda function triggered by SQS queue events.
 *
 * Defaults for the queue are:
 *  - visibilityTimeout: timeout from the lambdaProps or 60 seconds if not defined
 *  - encryption: QueueEncryption.KMS_MANAGED
 *  - removalPolicy: RemovalPolicy.DESTROY
 */
export class QueueLambda extends Construct {
  queue: Queue;

  lambda: Function;

  constructor(
    scope: Construct,
    id: string,
    lambda: Function,
    queueProps?: Partial<QueueProps>,
  ) {
    super(scope, `${id}QueueLambda`);

    // Incoming message queue
    this.queue = new Queue(scope, `${id}Queue`, {
      visibilityTimeout: lambda.timeout, // NB Message timeout needs to match between the queue and the lambda
      encryption: QueueEncryption.KMS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      ...queueProps,
    });

    this.lambda = lambda;
    this.lambda.addEventSource(new SqsEventSource(this.queue, { reportBatchItemFailures: true }));
  }

  static node(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    functionProps?: Partial<FunctionProps>,
    queueProps?: Partial<QueueProps>,
  ): QueueLambda {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.NODEJS_18_X, timeout: Duration.seconds(60), ...functionProps });
    return new QueueLambda(scope, id, lambda, queueProps);
  }

  static python(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    functionProps?: Partial<FunctionProps>,
    queueProps?: Partial<QueueProps>,
  ): QueueLambda {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.PYTHON_3_10, timeout: Duration.seconds(60), ...functionProps });
    return new QueueLambda(scope, id, lambda, queueProps);
  }

  static container(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<DockerImageFunctionProps>,
    queueProps?: Partial<QueueProps>,
    tagOrDigest?: string,
    ecr?: Repository,
    initialPass: boolean = false,
  ): QueueLambda {
    const lambda = new ContainerFunction(scope, id, environment, { timeout: Duration.seconds(60), ...lambdaProps }, tagOrDigest, ecr, initialPass);
    return new QueueLambda(scope, id, lambda, queueProps);
  }
}
