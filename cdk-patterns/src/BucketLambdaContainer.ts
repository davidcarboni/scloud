import { DockerImageFunctionProps, Function, FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Bucket, BucketProps, EventType } from 'aws-cdk-lib/aws-s3';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { PrivateBucket } from './PrivateBucket';
import { ContainerFunction } from './ContainerFunction';

/**
 * A container Lambda function triggered by s3 bucket events.
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
export class BucketLambdaContainer extends Construct {
  containerFunction: ContainerFunction;

  bucket: Bucket;

  constructor(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    lambdaProps?: Partial<DockerImageFunctionProps>,
    bucketProps?: Partial<BucketProps>,
    tagOrDigest?: string,
    ecr?: Repository,
    events: EventType[] = [EventType.OBJECT_CREATED],
    initialPass: boolean = false,
  ) {
    super(scope, `${id}BucketLambdaContainer`);

    // Triggering bucket
    this.bucket = new PrivateBucket(scope, `${id}Bucket`, bucketProps);

    this.containerFunction = new ContainerFunction(scope, id, environment, { ...lambdaProps }, tagOrDigest, ecr, initialPass);
    this.containerFunction.lambda.addEventSource(new S3EventSource(this.bucket, { events }));
  }
}
