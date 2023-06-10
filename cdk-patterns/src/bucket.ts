import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  BucketProps,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * A private bucket bucket.
 * @param construct The parent CDK construct.
 * @param name The bucket name - used as the ID for CDK.
 * The actual bucket name will be randomised by default.
 * @param props Any additional properties for the bucket.
 * These can override the defaults provided by this function.
 * @returns A new Bucket
 */
export function privateBucket(construct: Construct, name: string, props: BucketProps = {}): Bucket {
  return new Bucket(construct, name, {
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.S3_MANAGED,
    removalPolicy: RemovalPolicy.DESTROY,
    ...props,
  });
}

/**
 * A bucket with a KMS key.
 * @param stack The parent CDK stack.
 * @param name The bucket name - used as the bucket and key IDs for CDK.
 * The actual bucket name will be randomised by default.
 * @param props Any additional properties for the bucket.
 * These can override the defaults provided by this function.
 * @returns An s3.Bucket
 */
export function kmsBucket(
  stack: Stack,
  name: string,
  props: BucketProps = {},
): { bucket: Bucket, key?: Key; } {
  // We set a key alias because this seems to be the only
  // identifying information shown in the list in the AWS console:
  const key = new Key(stack, `BucketKey${name}`, { removalPolicy: RemovalPolicy.DESTROY, alias: `${stack.stackName}/${name}`, description: name });
  const bucket = new Bucket(stack, name, {
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.KMS,
    bucketKeyEnabled: false,
    removalPolicy: RemovalPolicy.DESTROY,
    ...props,
  });

  return {
    bucket,
    key,
  };
}
