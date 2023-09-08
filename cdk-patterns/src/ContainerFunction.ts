import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  DockerImageCode, DockerImageFunction, DockerImageFunctionProps,
} from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { ecrRepository } from './ecrRepository';
import { addGhaLambda } from './ghaUser';

export class ContainerFunction extends Construct {
  repository: Repository;

  lambda: DockerImageFunction;

  /**
   * A Lambda function packaged as a container.
   * @param construct Parent CDK construct (typically 'this')
   * @param initialPass If the infrastructure is being built from scratch: true;
   * for incremental deployments: false.
   * @param name The name for this function
   * @param environment Environment variables for the Lambda function
   * @returns The lambda, if created, and associated ECR repository
   */
  constructor(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    props?: Partial<DockerImageFunctionProps>,
    tagOrDigest?: string,
    ecr?: Repository,
    initialPass: boolean = false,
  ) {
    // We set a key alias because this seems to be the only
    // identifying information shown in the list in the AWS console:
    super(scope, id);
    // Repository for function container image
    this.repository = ecr || ecrRepository(scope, `${id}Repository`);

    // Container
    const code = initialPass ? DockerImageCode.fromImageAsset(path.join(__dirname, './container')) : DockerImageCode.fromEcr(this.repository, {
      tagOrDigest: tagOrDigest || 'latest',
    });

    this.lambda = new DockerImageFunction(scope, `${id}Function`, {
      code,
      logRetention: logs.RetentionDays.THREE_MONTHS,
      environment,
      description: id,
      ...props,
    });
    addGhaLambda(scope, id, this.lambda);
  }
}