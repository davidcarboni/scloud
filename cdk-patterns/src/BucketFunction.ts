import {
  DockerImageFunctionProps, Function, FunctionProps, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Bucket, BucketProps, EventType } from 'aws-cdk-lib/aws-s3';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { PrivateBucket } from './PrivateBucket';
import { ZipFunction } from './ZipFunction';
import { ContainerFunction } from './ContainerFunction';

/**
 * A Lambda function triggered by s3 bucket events.
 *
 * Defaults for the bucket are as per PrivateBucket:
 *  - encryption: BucketEncryption.S3_MANAGED
 *  = blockPublicAccess: BlockPublicAccess.BLOCK_ALL
 *  - removalPolicy: RemovalPolicy.DESTROY
 *
 * NB By default, Cloudformation will attempt to destroy the bucket when the stack is destroyed,
 * however we don't set auto-delete objects to true, so this will fail if the bucket is not empty,
 * which prevents losing content,
 *
 * The reason for this is that when experimenting with building stacks you can end up with a
 * bunch of orphaned resources. This setting effectively protects buckets that have content in them
 * But allows for deleting an empty bucket.
 *
 * If you want to delete the bucket and all contents, pass { autoDeleteObjects: true } in bucketProps.
 */
export class BucketFunction extends Construct {
  bucket: Bucket;

  lambda: Function;

  constructor(
    scope: Construct,
    id: string,
    lambda: Function,
    bucketProps?: Partial<BucketProps>,
    events: EventType[] = [EventType.OBJECT_CREATED],
  ) {
    super(scope, `${id}BucketFunction`);
    // Triggering bucket
    this.bucket = new PrivateBucket(scope, `${id}Bucket`, bucketProps);
    this.lambda = lambda;
    this.lambda.addEventSource(new S3EventSource(this.bucket, { events }));
  }

  static node(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    functionProps?: Partial<FunctionProps>,
    bucketProps?: Partial<BucketProps>,
    events: EventType[] = [EventType.OBJECT_CREATED],
  ): BucketFunction {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.NODEJS_18_X, ...functionProps });
    return new BucketFunction(scope, id, lambda, bucketProps, events);
  }

  static python(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    functionProps?: Partial<FunctionProps>,
    bucketProps?: Partial<BucketProps>,
    events: EventType[] = [EventType.OBJECT_CREATED],
  ): BucketFunction {
    const lambda = new ZipFunction(scope, id, environment, { runtime: Runtime.PYTHON_3_10, ...functionProps });
    return new BucketFunction(scope, id, lambda, bucketProps, events);
  }

  static container(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<DockerImageFunctionProps>,
    bucketProps?: Partial<BucketProps>,
    tagOrDigest?: string,
    ecr?: Repository,
    events: EventType[] = [EventType.OBJECT_CREATED],
    initialPass: boolean = false,
  ): BucketFunction {
    const lambda = new ContainerFunction(scope, id, environment, lambdaProps, tagOrDigest, ecr, initialPass);
    return new BucketFunction(scope, id, lambda, bucketProps, events);
  }
}
