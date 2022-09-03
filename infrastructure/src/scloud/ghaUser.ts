import {
  CfnAccessKey, ManagedPolicy, PolicyStatement, User,
} from 'aws-cdk-lib/aws-iam';
import { CfnOutput, Stack } from 'aws-cdk-lib';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { IFargateService } from 'aws-cdk-lib/aws-ecs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront';

export const ghaResources = {
  repositories: <IRepository[]>[],
  buckets: <IBucket[]>[],
  lambdas: <IFunction[]>[],
  services: <IFargateService[]>[],
  distributions: <IDistribution[]>[],
};

let user: User;
let policy: ManagedPolicy;

function addToPolicy(stack: Stack, name: string, resources: string[], actions: string[]) {
  if (resources.length > 0) {
    policy.addStatements(new PolicyStatement({
      actions,
      resources,
    }));
  }
}

/**
 * A user for Gihud Actions CI/CD.
 */
export function ghaUser(stack: Stack): CfnAccessKey | undefined {
  // A user with the policy attached
  user = new User(stack, 'ghaUser', { userName: `gha-${stack.stackName}` });
  policy = new ManagedPolicy(stack, `gha-${stack.stackName}-policy`, {
    managedPolicyName: `gha-${stack.stackName}-policy`,
  });
  user.addManagedPolicy(policy);

  // Credentials
  let accessKey: CfnAccessKey | undefined;
  if (!process.env.REKEY) {
    accessKey = new CfnAccessKey(stack, 'ghaUserAccessKey', {
      userName: user.userName,
    });

    // Access key details for GHA secrets
    new CfnOutput(stack, 'awsAccessKeyId', { value: accessKey.ref });
    new CfnOutput(stack, 'awsSecretAccessKey', { value: accessKey.attrSecretAccessKey });
  }

  // ECR repositories - push/pull images
  const repositoryArns = ghaResources.repositories
    .filter((repository) => repository)
    .map((repository) => repository.repositoryArn);
  if (repositoryArns.length > 0) addToPolicy(stack, 'ecrLogin', ['*'], ['ecr:GetAuthorizationToken']);
  addToPolicy(stack, 'ecrRepositories', repositoryArns, [
    'ecr:GetDownloadUrlForLayer',
    'ecr:BatchGetImage',
    'ecr:BatchDeleteImage',
    'ecr:CompleteLayerUpload',
    'ecr:UploadLayerPart',
    'ecr:InitiateLayerUpload',
    'ecr:BatchCheckLayerAvailability',
    'ecr:PutImage',
    'ecr:ListImages',
  ]);

  // Buckets - upload/sync
  const bucketArns = ghaResources.buckets
    .filter((bucket) => bucket)
    .map((bucket) => bucket.bucketArn);
  addToPolicy(stack, 'buckets', bucketArns, [
    's3:ListBucket',
    's3:PutObject',
    's3:DeleteObject',
  ]);

  // Lambdas - update update with a new zip/container build
  const lambdaArns = ghaResources.lambdas
    .filter((lambda) => lambda)
    .map((lambda) => lambda.functionArn);
  addToPolicy(stack, 'lambdas', lambdaArns, [
    'lambda:UpdateFunctionCode',
    // 'lambda:PublishVersion',
  ]);

  // Fargate services - update with a new container build
  const serviceArns = ghaResources.services
    .filter((service) => service)
    .map((service) => service.serviceArn);
  addToPolicy(stack, 'fargateServices', serviceArns, [
    'ecs:UpdateService',
  ]);

  // Cloudfront distribution - cache invalidation
  const distributionArns = ghaResources.distributions
    .filter((distribution) => distribution !== undefined)
    // Not sure where to 'properly' get a distribution ARN from?
    .map((distribution) => `arn:aws:cloudfront::${stack.account}:distribution/${distribution.distributionId}`);
  addToPolicy(stack, 'distributions', distributionArns, [
    'cloudfront:CreateInvalidation',
  ]);

  return accessKey;
}
