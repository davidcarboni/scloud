import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';
import {
  Code, DockerImageCode, DockerImageFunction, DockerImageFunctionProps, Function, FunctionProps, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import ecrRepository from './ecrRepository';
import { addGhaLambda } from './ghaUser';

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
  lambdaProps?: Partial<DockerImageFunctionProps>,
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
    logRetention: logs.RetentionDays.THREE_MONTHS,
    environment,
    description: name,
    ...lambdaProps,
  });
  addGhaLambda(construct, name, lambda);
  return { lambda, repository };
}

/**
 * A Lambda function packaged as a zip file.
 * @param construct Parent CDK construct (typically 'this')
 * @param name The name for this function
 * @param environment Environment variables for the Lambda function
 * @returns The lambda, if created, and associated ECR repository
 */
export function zipFunctionTypescript(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
  lambdaProps?: Partial<FunctionProps>,
): Function {
  const lambda = new Function(construct, `${name}Function`, {
    runtime: Runtime.NODEJS_16_X,
    handler: 'src/lambda.handler',
    code: Code.fromAsset(path.join(__dirname, './lambda/nodejs')),
    logRetention: logs.RetentionDays.THREE_MONTHS,
    environment,
    description: name,
    ...lambdaProps,
  });
  addGhaLambda(construct, name, lambda);
  return lambda;
}

/**
 * A Lambda function packaged as a zip file.
 * @param construct Parent CDK construct (typically 'this')
 * @param name The name for this function
 * @param environment Environment variables for the Lambda function
 * @returns The lambda, if created, and associated ECR repository
 */
export function zipFunctionPython(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
  lambdaProps?: Partial<FunctionProps>,
): Function {
  const lambda = new Function(construct, `${name}Function`, {
    runtime: Runtime.PYTHON_3_9,
    handler: 'src/lambda.handler',
    code: Code.fromAsset(path.join(__dirname, './lambda/python')),
    logRetention: logs.RetentionDays.THREE_MONTHS,
    environment,
    description: name,
    ...lambdaProps,
  });
  addGhaLambda(construct, name, lambda);
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
  addGhaLambda(construct, name, edge);
  return edge;
}
