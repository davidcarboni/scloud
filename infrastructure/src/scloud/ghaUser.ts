/* eslint-disable no-param-reassign */
import {
  CfnAccessKey, ManagedPolicy, PolicyStatement, User,
} from 'aws-cdk-lib/aws-iam';
import { CfnOutput, Stack } from 'aws-cdk-lib';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { IFargateService } from 'aws-cdk-lib/aws-ecs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import * as fs from 'fs';

export interface GhaInfo {
  resources: {
  repositories: IRepository[],
  buckets: IBucket[],
  lambdas: IFunction[],
  services: IFargateService[],
  distributions: IDistribution[],
  },
  variables: string[],
  secrets: string[],
}

export function newGhaInfo(): GhaInfo {
  return {
    resources: {
      repositories: [],
      buckets: [],
      lambdas: [],
      services: [],
      distributions: [],
    },
    secrets: [],
    variables: [],
  };
}

export function addGhaVariable(cfnOutput: CfnOutput, ghaInfo: GhaInfo) {
  ghaInfo.variables = ghaInfo.variables || [];
  ghaInfo.variables.push(cfnOutput.node.id);
}

export function addGhaSecret(cfnOutput: CfnOutput, ghaInfo: GhaInfo) {
  ghaInfo.secrets = ghaInfo.secrets || [];
  ghaInfo.secrets.push(cfnOutput.node.id);
}

function addToPolicy(stack: Stack, name: string, policy: ManagedPolicy, resources: string[], actions: string[]) {
  if (resources.length > 0) {
    policy.addStatements(new PolicyStatement({
      actions,
      resources,
      sid: name,
    }));
  }
}

/**
 * A user for Gihud Actions CI/CD.
 */
export function ghaUser(stack: Stack, ghaInfo: GhaInfo): { user: User, accessKey: CfnAccessKey | undefined; } {
  // A user with the policy attached
  const user = new User(stack, 'ghaUser', { userName: `gha-${stack.stackName}` });
  const policy = new ManagedPolicy(stack, `gha-${stack.stackName}-policy`, {
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
    addGhaSecret(new CfnOutput(stack, 'awsAccessKeyId', { value: accessKey.ref }), ghaInfo);
    addGhaSecret(new CfnOutput(stack, 'awsSecretAccessKey', { value: accessKey.attrSecretAccessKey }), ghaInfo);
  }

  // ECR repositories - push/pull images
  const repositoryArns = ghaInfo.resources.repositories
    .filter((repository) => repository)
    .map((repository) => repository.repositoryArn);
  if (repositoryArns.length > 0) addToPolicy(stack, 'ecrLogin', policy, ['*'], ['ecr:GetAuthorizationToken']);
  addToPolicy(stack, 'ecrRepositories', policy, repositoryArns, [
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
  const bucketArns = ghaInfo.resources.buckets
    .filter((bucket) => bucket)
    .map((bucket) => bucket.bucketArn);
  addToPolicy(stack, 'buckets', policy, bucketArns, [
    's3:ListBucket',
  ]);
  const objectArns = bucketArns.map((arn) => `${arn}/*`);
  addToPolicy(stack, 'bucketObjects', policy, objectArns, [
    's3:PutObject',
    's3:DeleteObject',
  ]);

  // Lambdas - update update with a new zip/container build
  const lambdaArns = ghaInfo.resources.lambdas
    .filter((lambda) => lambda)
    .map((lambda) => lambda.functionArn);
  addToPolicy(stack, 'lambdas', policy, lambdaArns, [
    'lambda:UpdateFunctionCode',
    // 'lambda:PublishVersion',
  ]);

  // Fargate services - update with a new container build
  const serviceArns = ghaInfo.resources.services
    .filter((service) => service)
    .map((service) => service.serviceArn);
  addToPolicy(stack, 'fargateServices', policy, serviceArns, [
    'ecs:UpdateService',
  ]);

  // Cloudfront distribution - cache invalidation
  const distributionArns = ghaInfo.resources.distributions
    .filter((distribution) => distribution !== undefined)
    // Not sure where to 'properly' get a distribution ARN from?
    .map((distribution) => `arn:aws:cloudfront::${stack.account}:distribution/${distribution.distributionId}`);
  addToPolicy(stack, 'distributions', policy, distributionArns, [
    'cloudfront:CreateInvalidation',
  ]);

  if (fs.existsSync('secrets')) {
    // Write out the list of secret and variable names:
    fs.writeFileSync(`secrets/${stack.stackName}.ghaSecrets.json`, JSON.stringify(ghaInfo.secrets));
    fs.writeFileSync(`secrets/${stack.stackName}.ghaVariables.json`, JSON.stringify(ghaInfo.variables));
  }

  return { user, accessKey };
}
