import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Bucket, BucketProps, EventType } from 'aws-cdk-lib/aws-s3';
import { PrivateBucket } from './PrivateBucket';
import { ZipFunction, ZipFunctionProps } from './ZipFunction';
import { ContainerFunction, ContainerFunctionProps } from './ContainerFunction';

/**
 * @param lambda The Lambda function to be triggered by the bucket. This will be generated for you if you use one of the static methods (node, python, container)
 * @param events Default [EventType.OBJECT_CREATED]: The bucket events that will trigger the Lambda function
 * @param bucketProps Optional: If you need to specify any detailed properties for the SQS Queue, you can do so here and they will override any defaults
 */
export interface BucketFunctionProps {
  lambda: Function,
  events?: EventType[],
  bucketProps?: Partial<BucketProps>,
}

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
    props: BucketFunctionProps,
  ) {
    super(scope, `${id}BucketFunction`);
    // Triggering bucket
    this.bucket = new PrivateBucket(scope, `${id}Bucket`, props.bucketProps);
    this.lambda = props.lambda;
    this.lambda.addEventSource(new S3EventSource(this.bucket, { events: props.events || [EventType.OBJECT_CREATED] }));
  }

  static node(
    scope: Construct,
    id: string,
    functionProps?: ZipFunctionProps,
    events?: EventType[],
    bucketProps?: Partial<BucketProps>,
  ): BucketFunction {
    const lambda = ZipFunction.node(scope, id, functionProps);
    return new BucketFunction(scope, id, { lambda, bucketProps, events });
  }

  static python(
    scope: Construct,
    id: string,
    functionProps?: ZipFunctionProps,
    events?: EventType[],
    bucketProps?: Partial<BucketProps>,
  ): BucketFunction {
    const lambda = ZipFunction.python(scope, id, functionProps);
    return new BucketFunction(scope, id, { lambda, bucketProps, events });
  }

  static container(
    scope: Construct,
    id: string,
    functionProps?: ContainerFunctionProps,
    events?: EventType[],
    bucketProps?: Partial<BucketProps>,
  ): BucketFunction {
    const lambda = new ContainerFunction(scope, id, functionProps);
    return new BucketFunction(scope, id, { lambda, bucketProps, events });
  }
}
