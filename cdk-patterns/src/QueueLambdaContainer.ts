import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageFunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Queue, QueueEncryption, QueueProps } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { ContainerFunction } from './ContainerFunction';

/**
 * A container Lambda function triggered by SQS queue events.
 *
 * Defaults for the queue are:
 *  - visibilityTimeout: timeout from the lambdaProps or 60 seconds if not defined
 *  - encryption: QueueEncryption.KMS_MANAGED
 *  - removalPolicy: RemovalPolicy.DESTROY
 */
export class QueueLambdaContainer extends Construct {
  queue: Queue;

  containerFunction: ContainerFunction;

  constructor(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    ecr?: Repository,
    lambdaProps?: Partial<DockerImageFunctionProps>,
    queueProps?: Partial<QueueProps>,
    initialPass?: boolean,
  ) {
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

    this.containerFunction = new ContainerFunction(scope, id, environment, { ...lambdaProps, timeout }, 'latest', ecr, initialPass);
    this.containerFunction.lambda.addEventSource(new SqsEventSource(this.queue, { reportBatchItemFailures: true }));
  }
}
