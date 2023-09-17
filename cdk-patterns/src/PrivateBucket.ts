import { RemovalPolicy } from 'aws-cdk-lib';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  BucketProps,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * A private bucket.
 *
 * This bucket will not beaccessible from the internet.
 *
 * NB removalPolicy is set to DESTROY by default, but autoDeleteObjects is set to false.
 * This means that, only if the bucket is empty, it'll be destroyed when removed from the stack.
 * The rationale is that content you don't want to lose will block bucket deletion and, if
 * content is expendable, you can set autoDeleteObjects to true.
 *
 * @param construct The parent CDK construct.
 * @param name The bucket name - used as the ID for CDK.
 * The actual bucket name will be randomised by default.
 * @param props Any additional properties for the bucket.
 * These can override the defaults provided by this function.
 */
export class PrivateBucket extends Bucket {
  constructor(scope: Construct, id: string, props?: Partial<BucketProps>) {
    super(scope, id, {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      ...props,
    });
  }
}
