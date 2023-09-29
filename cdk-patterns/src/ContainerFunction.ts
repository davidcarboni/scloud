import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import {
  DockerImageCode, DockerImageFunction, DockerImageFunctionProps,
} from 'aws-cdk-lib/aws-lambda';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Duration } from 'aws-cdk-lib';
import { EcrRepository } from './EcrRepository';
import { githubActions } from './GithubActions';

/**
 * @param environment Environment variables for the Lambda function
 * @param tagOrDigest Default 'latest': The container image tag or digest
 * @param repository The ECR repository to use. If not specified a new one will be created
 * @param initialPass Default false: If the infrastructure is being built from scratch: true, for incremental deployments: false. This is because you'll need an image pushed to the ECR repository before you can reference it
 * @param memorySize Deafult 1024: the amount of memory to allocate to the Lambda function
 * @param dockerImageFunctionProps If you need to specify any detailed properties for the Lambda function, you can do so here and they will override any defaults
 */
export interface ContainerFunctionProps {
  environment?: { [key: string]: string; },
  memorySize?: number,
  timeout?: Duration,
  tagOrDigest?: string,
  repository?: Repository,
  initialPass?: boolean,
  dockerImageFunctionProps?: Partial<DockerImageFunctionProps>,
}

/**
 * A Lambda function packaged as a container.
 *
 * This construct automatically adds itself and the ECR repository (if created) to the list of resources Github Actions needs to access for CI/CD updates.
 *
 * Default log retention is 2 years.
 *
 * NB when a ContainerFunction is first built you'll need to set initialPass to true.
 * This is because the ECR repository needs to be created before a container image can be pushed to it.
 * However this construct will fail to build if there is no image in the ECR repository, so it needs to be built in two passes:
 * initially to create the repository and then to reference an image once one has been pushed to the repository.
 */
export class ContainerFunction extends DockerImageFunction {
  repository: Repository;

  constructor(
    scope: Construct,
    id: string,
    props?: ContainerFunctionProps,
  ) {
    // Repository for function container image
    // NB this will be created on the initial pass
    // It then needs to be populated with an image
    // After that the image can be referenced by this construct
    const repository = props?.repository || new EcrRepository(scope, `${id}Repository`);

    // Container
    const code = props?.initialPass ? DockerImageCode.fromImageAsset(path.join(__dirname, './container')) : DockerImageCode.fromEcr(repository, {
      tagOrDigest: props?.tagOrDigest || 'latest',
    });

    super(scope, `${id}ContainerFunction`, {
      code,
      logRetention: logs.RetentionDays.TWO_YEARS,
      environment: props?.environment,
      description: id,
      memorySize: props?.memorySize || 1024,
      ...props?.dockerImageFunctionProps,
    });

    this.repository = repository;
    githubActions(scope).addGhaLambda(id, this);
  }
}
