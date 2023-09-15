import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Repository, RepositoryProps } from 'aws-cdk-lib/aws-ecr';
import { githubActions } from './GithubActions';

/**
 * An ECR repository.
 *
 * This construct automatically adds itself to the list of resources Github Actions needs to access.
 *
 * The removal policy is set to DESTROY by default.
 * This won't actually delete any container images if the stack is deleted,
 * but it will clean up the repository if it's empty.
 *
 * You can customise the construct via the oprional props parameter.
 */
export class EcrRepository extends Repository {
  constructor(scope: Construct, id: string, props?: Partial<RepositoryProps>) {
    super(scope, `${id}Repository`, {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      ...props,
    });
    githubActions(scope).addGhaRepository(id, this);
  }
}
