import { Duration } from 'aws-cdk-lib';
import { Function, FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Bucket, BucketProps, EventType } from 'aws-cdk-lib/aws-s3';
import { zipFunction } from './lambdaFunction';
import { privateBucket } from './bucket';

/**
 * A Lambda function triggered by s3 bucket events.
 *
 * Defaults for the bucket are as per privateBucket:
 *  - encryption: BucketEncryption.S3_MANAGED
 *  = blockPublicAccess: BlockPublicAccess.BLOCK_ALL
 *  - removalPolicy: RemovalPolicy.DESTROY
 *
 * NB By default, Cloudformation will attempt to destroy the bucket when the stack is destroyed,
 * however we don't set auto-delete objects to true, so this will fail if the bucket is not empty,
 * which is a good thing for not losing content.
 *
 * The reason for this is that when experimenting with building stacks you can end up with quite a
 * bunch of orphaned resources. This setting effectively protects buckets that have content in them
 * But allows for deleting an empty bucket.
 *
 * If you want to delete the bucket and all contents, pass { autoDeleteObjects: true } in bucketProps.
 */
export function bucketLambda(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
  lambdaProps?: Partial<FunctionProps>,
  bucketProps?: Partial<BucketProps>,
  events: EventType[] = [EventType.OBJECT_CREATED],
): { bucket: Bucket, lambda: Function, policy?: ManagedPolicy; } {
  // NB Message timeout needs to match netween the queue and the lambda:
  const timeout: Duration = lambdaProps?.timeout || Duration.seconds(60);

  // Triggering bucket
  const bucket = privateBucket(construct, `${name}Bucket`, bucketProps);

  const lambda = zipFunction(construct, name, environment, { ...lambdaProps, timeout });
  lambda.addEventSource(new S3EventSource(bucket, { events }));

  return {
    bucket, lambda,
  };
}
