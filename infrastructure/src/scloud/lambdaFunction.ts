import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import {
  Code, DockerImageCode, DockerImageFunction, Function, IFunction, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import ecrRepository from './ecrRepository';

function output(
  construct: Construct,
  name: string,
  lambda: IFunction,
) {
  const lambdaOutputName = `lambda${name[0].toUpperCase()}${name.toLowerCase().slice(1)}`;
  new CfnOutput(construct, lambdaOutputName, { value: lambda.functionName });
}

/**
 * A Lambda function packaged as a container.
 * @param construct Parent CDK construct (typically 'this')
 * @param initialPass If the infrastructure is being built from scratch: true;
 * for incremental deployments: false.
 * @param name The name for this function
 * @param environment Environment variables for the Lambda function
 * @returns The lambda, if created, and associated ECR repository
 */
export function containerFunction(
  construct: Construct,
  initialPass: boolean,
  name: string,
  environment?: { [key: string]: string; },
  tagOrDigest?: string,
  ecr?: Repository,
): { lambda: Function, repository: Repository; } {
  // Repository for function container image
  const repository = ecr || ecrRepository(construct, name);

  // Container
  const code = initialPass ? DockerImageCode.fromImageAsset(path.join(__dirname, './container')) : DockerImageCode.fromEcr(repository, {
    tagOrDigest: tagOrDigest || 'latest',
  });

  const lambda = new DockerImageFunction(construct, `${name}Function`, {
    code,
    memorySize: 512,
    timeout: Duration.seconds(900),
    logRetention: logs.RetentionDays.THREE_MONTHS,
    environment,
    description: name,
  });
  output(construct, name, lambda);
  return { lambda, repository };
}

/**
 * A Lambda function packaged as a zip file.
 * @param construct Parent CDK construct (typically 'this')
 * @param name The name for this function
 * @param environment Environment variables for the Lambda function
 * @returns The lambda, if created, and associated ECR repository
 */
export function zipFunction(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
  memory: number = 256,
  concurrency: number = 5,
  handler: string = 'src/lambda.handler',
): Function {
  const lambda = new Function(construct, `${name}Function`, {
    runtime: Runtime.NODEJS_14_X,
    code: Code.fromAsset(path.join(__dirname, './lambda')),
    handler,
    memorySize: memory,
    reservedConcurrentExecutions: concurrency,
    timeout: Duration.seconds(60),
    logRetention: logs.RetentionDays.THREE_MONTHS,
    environment,
    description: name,
  });
  output(construct, name, lambda);
  return lambda;
}

/**
 * A Lambda@edge function.
 * @param construct Parent CDK construct (typically 'this')
 * @param name The name for this function
 * @param environment Environment variables for the Lambda function
 * @returns The lambda, if created, and associated ECR repository
 */
export function edgeFunction(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
): cloudfront.experimental.EdgeFunction {
  const edge = new cloudfront.experimental.EdgeFunction(
    construct,
    `${name}EdgeFunction`,
    {
      functionName: name, // Resolves "...the resource's physical name must be explicit set..."
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset(path.join(__dirname, './edge')),
      handler: 'src/lambda.handler',
      memorySize: 256,
      logRetention: logs.RetentionDays.THREE_MONTHS,
      environment,
    },
  );
  output(construct, name, edge.lambda);
  return edge;
}
