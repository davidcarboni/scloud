/* eslint-disable @typescript-eslint/ban-types */
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  Code, DockerImageCode, DockerImageFunction, DockerImageFunctionProps, Function, FunctionProps, Runtime,
} from 'aws-cdk-lib/aws-lambda';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { ecrRepository } from './ecrRepositoryDeprecated';
import { addGhaLambda } from './ghaUserDeprecated';

/**
 * @deprecated Use ContainerFunction instead
 *
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
  ecr?: IRepository,
): { lambda: Function, repository: IRepository; } {
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
 * @deprecated Use ZipFunction.typescript() or ZipFunction.python() instead
 *
 * A Lambda function packaged as a zip file.
 * Key defaults are:
 *  - runtime: Runtime.NODEJS_18_X
 *  - handler: 'src/lambda.handler'
 *  - logRetention: logs.RetentionDays.TWO_YEARS
 * @param construct Parent CDK construct (typically 'this')
 * @param name The name for this function
 * @param environment Environment variables for the Lambda function
 * @param lambdaProps Override properties for the Lambda function. you may want to pass e.g. { runtime: Runtime.PYTHON_3_10 }
 * @returns The lambda, if created, and associated ECR repository
 */
export function zipFunction(
  construct: Construct,
  name: string,
  environment?: { [key: string]: string; },
  lambdaProps?: Partial<FunctionProps>,
): Function {
  const lambda = new Function(construct, `${name}Function`, {
    runtime: Runtime.NODEJS_18_X,
    handler: 'src/lambda.handler',
    code: Code.fromInline('Placeholder code'), // Asset(path.join(__dirname, './lambda/python')),
    logRetention: logs.RetentionDays.TWO_YEARS,
    environment,
    description: name,
    ...lambdaProps,
  });
  addGhaLambda(construct, name, lambda);
  return lambda;
}

/**
 * NB: This pattern is not well developed or maintained at the time of writing.
 *
 * A key reason for this is that I haven't worked out how to deal well with lambda function versions in CI/CD
 * which seemed to be needed when deploying an update to an edge function.
 *
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
