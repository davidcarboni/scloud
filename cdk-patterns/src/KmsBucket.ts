import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  BucketProps,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface KmsBucketProps extends BucketProps {
  /**
   * Pass null to indicate you don't want a key alias.
   * This is useful when importing a bucket and key into a stack.
   */
  keyAlias: string | null;
}

/**
 * A bucket with a KMS key.
 * @param props Any additional properties for the bucket. These can override the defaults provided by this function.
 * NB if you don't want a key alias, pass null for keyAlias. This is useful when importing a bucket and key into a stack.
 * @returns An s3.Bucket
 */
export class KmsBucket extends Construct {
  key: Key;

  bucket: Bucket;

  constructor(scope: Construct, id: string, props: Partial<KmsBucketProps>) {
    // We set a key alias because this seems to be the only
    // identifying information shown in the list in the AWS console.
    // If explicitly null, we don't set an alias, otherwise use the value passed in
    const alias = props.keyAlias === null ? undefined : props.keyAlias || `${Stack.of(scope).stackName}/${id}`;
    super(scope, `${id}KmsBucket`);
    this.key = new Key(scope, `KmsKey${id}`, { removalPolicy: RemovalPolicy.RETAIN, alias, description: id });
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
