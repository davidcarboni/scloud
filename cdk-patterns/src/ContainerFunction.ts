import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  DockerImageCode, DockerImageFunction, DockerImageFunctionProps, Function,
} from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { EcrRepository } from './EcrRepository';
import { githubActions } from './GithubActions';

/**
 * A Lambda function packaged as a container.
 *
 * This construct automatically adds itself to the list of resources Github Actions needs to access.
 *
 * NB when a ContainerFunction is first built you'll need to set initialPass to true.
 * This is because the ECR repository needs to be created before the container image can be pushed to it.
 * This construct will fail to build if there is no image in the ECR repository.
 *
 * @param construct Parent CDK construct (typically 'this')
 * @param initialPass If the infrastructure is being built from scratch: true, for incremental deployments: false.
 * @param name The name for this function
 * @param environment Environment variables for the Lambda function
 * @returns The lambda, if created, and associated ECR repository
 */
export class ContainerFunction extends DockerImageFunction {
  repository: Repository;

  constructor(
    scope: Construct,
    id: string,
    environment?: { [key: string]: string; },
    props?: Partial<DockerImageFunctionProps>,
    tagOrDigest?: string,
    ecr?: Repository,
    initialPass: boolean = false,
  ) {
    // Repository for function container image
    // NB this will be created on the initial pass
    // It then needs to be populated with an image
    // After that the image can be referenced by this construct
    const repository = ecr || new EcrRepository(scope, `${id}Repository`);

    // Container
    const code = initialPass ? DockerImageCode.fromImageAsset(path.join(__dirname, './container')) : DockerImageCode.fromEcr(repository, {
      tagOrDigest: tagOrDigest || 'latest',
    });

    super(scope, `${id}ContainerFunction`, {
      code,
      logRetention: logs.RetentionDays.THREE_MONTHS,
      environment,
      description: id,
      ...props,
    });

    this.repository = repository;
    githubActions(scope).addGhaLambda(id, this);
  }
}
