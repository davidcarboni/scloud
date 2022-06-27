import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Effect, ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { containerFunction, zipFunction } from './lambdaFunction';

export function queueLambda(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
): { queue: Queue, lambda: Function, policy: ManagedPolicy; } {
  // Message timeout
  // This needs to match netween the queue and the lambda:
  const timeout = Duration.seconds(60);

  // Incoming message queue
  const queue = new Queue(construct, `${name}Queue`, {
    visibilityTimeout: timeout,
    encryption: QueueEncryption.KMS_MANAGED,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  // new CfnOutput(construct, `${name}QueueUrl`, { value: queue.queueUrl });

  const lambda = zipFunction(construct, name, environment);
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
  // new CfnOutput(construct, `${name}SenderPolicyArn`, { value: queue.queueUrl });

  return {
    queue, lambda, policy,
  };
}

export function queueLambdaContainer(
  construct: Construct,
  name: string,
  initialPass: boolean,
  environment?: { [key: string]: string; },
): { repository: Repository, queue: Queue, lambda: Function, policy: ManagedPolicy; } {
  // Message timeout
  // This needs to match netween the queue and the lambda:
  const timeout = Duration.seconds(60);

  // Incoming message queue
  const queue = new Queue(construct, `${name}Queue`, {
    visibilityTimeout: timeout,
    encryption: QueueEncryption.KMS_MANAGED,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  // new CfnOutput(construct, `${name}QueueUrl`, { value: queue.queueUrl });

  const { repository, lambda } = containerFunction(construct, initialPass, name, environment);
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
  // new CfnOutput(construct, `${name}SenderPolicyArn`, { value: queue.queueUrl });

  return {
    repository, queue, lambda, policy,
  };
}
