import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { DockerImageFunctionProps, Function, FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Effect, ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { containerFunction, zipFunctionTypescript } from './lambdaFunction';

export function queueLambda(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
  lambdaProps?: Partial<FunctionProps>,
): { queue: Queue, lambda: Function, policy: ManagedPolicy; } {
  // NB Message timeout needs to match netween the queue and the lambda:
  const timeout: Duration = lambdaProps?.timeout || Duration.seconds(60);

  // Incoming message queue
  const queue = new Queue(construct, `${name}Queue`, {
    visibilityTimeout: timeout,
    encryption: QueueEncryption.KMS_MANAGED,
    removalPolicy: RemovalPolicy.DESTROY,
  });

  const lambda = zipFunctionTypescript(construct, name, environment, { ...lambdaProps, timeout });
  lambda.addEventSource(new SqsEventSource(queue, { reportBatchItemFailures: true }));

  // Policy enabling message sending to the queue
  const policy = new ManagedPolicy(construct, `${name}SenderPolicy`, {
    // managedPolicyName: `${name}-sender`,
    statements: [
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [queue.queueArn],
        actions: [
          'sqs:SendMessage',
        ],
      }),
    ],
  });

  return {
    queue, lambda, policy,
  };
}

export function queueLambdaContainer(
  construct: Construct,
  name: string,
  initialPass: boolean,
  environment?: { [key: string]: string; },
  ecr?: Repository,
  lambdaProps?: Partial<DockerImageFunctionProps>,
): { repository: Repository, queue: Queue, lambda: Function; } {
  // Message timeout
  // This needs to match netween the queue and the lambda:
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
