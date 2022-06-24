import { Repository } from 'aws-cdk-lib/aws-ecr';
import {
  CfnAccessKey, Effect, Policy, PolicyStatement, User,
} from 'aws-cdk-lib/aws-iam';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { CfnOutput, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
// import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

/**
 * A user for Gihud Actions CI/CD.
 */
export default function ghaUser(
  stack: Stack,
  ecrRepositories: Repository[],
  buckets?: Bucket[],
  lambdas?: IFunction[],
  // edgeLambdas?: cloudfront.experimental.EdgeFunction[],
  services?: ecs.FargateService[],
  distributions?: Distribution[],
): CfnAccessKey | undefined {
  const statements: PolicyStatement[] = [];

  // ECR login
  if (ecrRepositories.length > 0) {
    statements.push(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'ecr:GetAuthorizationToken',
      ],
      resources: [
        '*',
      ],
    }));
  }

  // ECR repositories
  const repositoryArns = ecrRepositories
    .filter((repository) => repository !== undefined)
    .map((repository) => repository.repositoryArn);
  if (repositoryArns.length > 0) {
    statements.push(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'ecr:BatchDeleteImage',
        'ecr:CompleteLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:InitiateLayerUpload',
        'ecr:BatchCheckLayerAvailability',
        'ecr:PutImage',
        'ecr:ListImages',
      ],
      resources: repositoryArns,
    }));
  }

  // Buckets
  if (buckets !== undefined && buckets.length > 0) {
    // s3 needs both arn and arn/* to have access to the bucket and to bucket objects
    const bucketArns = buckets
      .filter((bucket) => bucket !== undefined)
      .map((bucket) => bucket.bucketArn);
    bucketArns.forEach((arn) => {
      bucketArns.push(`${arn}/*`);
    });
    if (bucketArns.length > 0) {
      statements.push(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          's3:ListBucket',
          's3:PutObject',
          's3:DeleteObject',
        ],
        resources: bucketArns,
      }));
    }
  }

  // Lambda functions
  let lambdaArns: string[] = [];
  if (lambdas !== undefined && lambdas.length > 0) {
    const functionArns = lambdas
      .filter((lambda) => lambda !== undefined)
      .map((lambda) => lambda.functionArn);
    lambdaArns = lambdaArns.concat(functionArns);
  }
  // if (edgeLambdas) {
  //   const edgeArns = edgeLambdas
  //     .filter((lambda) => lambda !== undefined)
  //     .map((lambda) => lambda.functionArn);
  //   lambdaArns = lambdaArns.concat(edgeArns);
  // }
  if (lambdaArns.length > 0) {
    statements.push(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'lambda:UpdateFunctionCode',
        'lambda:PublishVersion',
      ],
      resources: lambdaArns,
    }));
  }

  // Fargate services
  if (services !== undefined && services.length > 0) {
    const serviceArns = services
      .filter((service) => service !== undefined)
      .map((service) => service.serviceArn);
    if (serviceArns.length > 0) {
      statements.push(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'ecs:UpdateService',
        ],
        resources: serviceArns,
      }));
    }
  }

  // Cloudfront distribution invalidation
  if (distributions !== undefined && distributions.length > 0) {
    const distributionArns = distributions
      .filter((distribution) => distribution !== undefined)
      // Not sure where to 'properly' get a distribution ARN from?
      .map((distribution) => `arn:aws:cloudfront::${stack.account}:distribution/${distribution.distributionId}`);
    statements.push(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'cloudfront:CreateInvalidation',
      ],
      resources: distributionArns,
    }));
  }

  // A policy that includes these statments
  const ghaPolicy = new Policy(stack, 'ghaUserPolicy', {
    policyName: 'ghaUserPolicy',
    statements,
  });

  // A user with the policy attached
  const user = new User(stack, 'ghaUser', { userName: stack.stackName.toLowerCase() });
  user.attachInlinePolicy(ghaPolicy);

  // Credentials
  let accessKey: CfnAccessKey | undefined;
  if (!process.env.REKEY) {
    accessKey = new CfnAccessKey(stack, 'ghaUserAccessKey', {
      userName: user.userName,
    });

    // Access key details for use in setting GHA secrets
    new CfnOutput(stack, 'awsAccessKeyId', { value: accessKey.ref });
    new CfnOutput(stack, 'awsSecretAccessKey', { value: accessKey.attrSecretAccessKey });
  }

  return accessKey;
}
