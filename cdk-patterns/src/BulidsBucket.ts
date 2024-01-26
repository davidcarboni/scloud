import { Construct } from 'constructs';
import { BlockPublicAccess, BucketEncryption, BucketProps } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { PrivateBucket } from './PrivateBucket';
import { githubActions } from './GithubActions';

/**
 * A bucket to hold zip files for Lambda function code builds.
 *
 * This enables Lambda functions to reference zip files using Code.fromBucket(...)
 *
 * This is useful because updating a Lambda function in the infrastructure might set the Lambda code to a default placeholder, effectively taking the funtion offline.
 *
 * This construct also greates a Github Actions variable called 'BUILDS_BUCKET' that can be used in Github Actions workflows.
 *
 * @param construct The parent CDK construct.
 * @param id Defaults to 'builds'.
 * @param props Any additional properties for the bucket.
 * These can override the defaults provided by this function.
 */
export class BuildsBucket extends PrivateBucket {
  constructor(scope: Construct, id: string = 'builds', props: Partial<BucketProps> = {}) {
    super(scope, id, {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      ...props,
    });
    githubActions(scope).addGhaBucket('builds', this);
  }
}
