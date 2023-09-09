import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { ZipFunction } from './ZipFunction';

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

  lambda: ZipFunction;

  constructor(scope: Construct, id: string, environment?: { [key: string]: string; }, lambdaProps?: Partial<FunctionProps>, queueProps?: Partial<QueueProps>) {
    super(scope, id);

    // NB Message timeout needs to match between the queue and the lambda:
    const timeout: Duration = lambdaProps?.timeout || Duration.seconds(60);

    // Incoming message queue
    this.queue = new Queue(scope, `${id}Queue`, {
      visibilityTimeout: timeout,
      encryption: QueueEncryption.KMS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      ...queueProps,
    });

    this.lambda = new ZipFunction(scope, `${id}Function`, environment, {
      ...lambdaProps,
      timeout,
    });
    this.lambda.addEventSource(new SqsEventSource(this.queue, { reportBatchItemFailures: true }));
  }
}
