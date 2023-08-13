import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageFunctionProps, Function, FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { containerFunction, zipFunction } from './lambdaFunction';

/**
 * A Lambda function triggered by SQS queue events.
 *
 * Defaults for the queue are:
 *  - visibilityTimeout: timeout from the lambdaProps or 60 seconds if not defined
 *  - encryption: QueueEncryption.KMS_MANAGED
 *  - removalPolicy: RemovalPolicy.DESTROY
 */
export function queueLambda(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
  lambdaProps?: Partial<FunctionProps>,
): { queue: Queue, lambda: Function; } {
  // NB Message timeout needs to match between the queue and the lambda:
  const timeout: Duration = lambdaProps?.timeout || Duration.seconds(60);

  // Incoming message queue
  const queue = new Queue(construct, `${name}Queue`, {
    visibilityTimeout: timeout,
    encryption: QueueEncryption.KMS_MANAGED,
    removalPolicy: RemovalPolicy.DESTROY,
  });

  const lambda = zipFunction(construct, name, environment, { ...lambdaProps, timeout });
  lambda.addEventSource(new SqsEventSource(queue, { reportBatchItemFailures: true }));

  return {
    queue, lambda,
  };
}

/**
 * A container Lambda function triggered by SQS queue events.
 *
 * Defaults for the queue are:
 *  - visibilityTimeout: timeout from the lambdaProps or 60 seconds if not defined
 *  - encryption: QueueEncryption.KMS_MANAGED
 *  - removalPolicy: RemovalPolicy.DESTROY
 */
export function queueLambdaContainer(
  construct: Construct,
  name: string,
  initialPass: boolean,
  environment?: { [key: string]: string; },
  ecr?: IRepository,
  lambdaProps?: Partial<DockerImageFunctionProps>,
): { repository: IRepository, queue: Queue, lambda: Function; } {
  // NB Message timeout needs to match between the queue and the lambda:
  const timeout: Duration = lambdaProps?.timeout || Duration.seconds(60);

  // Incoming message queue
  const queue = new Queue(construct, `${name}Queue`, {
    visibilityTimeout: timeout,
    encryption: QueueEncryption.KMS_MANAGED,
    removalPolicy: RemovalPolicy.DESTROY,
  });

  const { repository, lambda } = containerFunction(construct, initialPass, name, environment, { ...lambdaProps, timeout }, 'latest', ecr);
  lambda.addEventSource(new SqsEventSource(queue, { reportBatchItemFailures: true }));

  return {
    repository, queue, lambda,
  };
}
