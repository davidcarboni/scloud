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
 * A bucket with a KMS key.
 * @param scope The parent CDK Stack (the stack name is used as part of the key alias).
 * @param name The bucket name - used as the bucket and key IDs for CDK.
 * The actual bucket name will be randomised by default.
 * @param props Any additional properties for the bucket.
 * These can override the defaults provided by this function.
 * @returns An s3.Bucket
 */
export class KmsBucket extends Construct {
  key: Key;

  bucket: Bucket;

  constructor(scope: Construct, id: string, props: Partial<BucketProps>) {
    // We set a key alias because this seems to be the only
    // identifying information shown in the list in the AWS console:
    super(scope, `${id}KmsBucket`);
    this.key = new Key(scope, `KmsKey${id}`, { removalPolicy: RemovalPolicy.RETAIN, alias: `${Stack.of(scope).stackName}/${id}_`, description: id });
    this.bucket = new Bucket(scope, id, {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.KMS,
      encryptionKey: this.key,
      bucketKeyEnabled: false,
      removalPolicy: RemovalPolicy.RETAIN,
      ...props,
    });
  }
}
