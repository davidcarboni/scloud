
import {
  CfnAccessKey, OpenIdConnectProvider, Role, User,
} from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { githubActions } from '../GithubActions';

// const ghaInfo = {
//   resources: {
//     repositories: <IRepository[]>[],
//     buckets: <IBucket[]>[],
//     lambdas: <IFunction[]>[],
//     services: <IFargateService[]>[],
//     distributions: <IDistribution[]>[],
//   },
//   secrets: <string[]>[],
//   variables: <string[]>[],
// };

// @deprecated - Use GithubActions instead
export function addGhaSecret(
  construct: Construct,
  name: string,
  value: string,
) {
  githubActions(construct).addGhaSecret(name, value);
}

// @deprecated - Use GithubActions instead
export function addGhaVariable(
  construct: Construct,
  name: string,
  type: string,
  value: string,
) {
  githubActions(construct).addGhaVariable(name, type, value);
}

// @deprecated - Use GithubActions instead
export function addGhaLambda(
  construct: Construct,
  name: string,
  lambda: IFunction,
) {
  githubActions(construct).addGhaLambda(name, lambda);
}

// @deprecated - Use GithubActions instead
export function addGhaBucket(
  construct: Construct,
  name: string,
  bucket: IBucket,
) {
  githubActions(construct).addGhaBucket(name, bucket);
}

// @deprecated - Use GithubActions instead
export function addGhaDistribution(
  construct: Construct,
  name: string,
  distribution: IDistribution,
) {
  githubActions(construct).addGhaDistribution(name, distribution);
}

// @deprecated - Use GithubActions instead
export function addGhaRepository(
  construct: Construct,
  name: string,
  repository: IRepository,
) {
  githubActions(construct).addGhaRepository(name, repository);
}

// @deprecated - Use GithubActions instead
export function saveGhaValues(stack: Stack) {
  githubActions(stack).saveGhaValues();
}

// @deprecated - Use GithubActions instead

export function ghaPolicy(stack: Stack) {
  return githubActions(stack).ghaPolicy();
}

/**
 * @deprecated - Use GithubActions instead
 *
 * Create an account-wide OIDC connection fo Guthub Actions.
 * NB only one OIDC provider for GitHub can be created per AWS account (because the provider URL must be unique).
 * To provide access to resources, you can create multiple roles that trust the provider so you'll probably want to call ghaOidcRole() instead.
 * See: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
 * @param repo What to grant access to. This is a minimum of a GitHub owner (user or org), optionally a repository name, and you can also specify a filter to limit access to e.g. a branch.
 */
export function ghaOidcProvider(stack: Stack): OpenIdConnectProvider {
  return githubActions(stack).ghaOidcProvider();
}

/**
 * @deprecated - Use GithubActions instead
 *
 * Add permissions to the GitHub OIDC role that allow workflows to access the AWS resources in this stack that need to be updated at build time.
 * See: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
 * @param repo The repository to grant access to (owner and name). You can also specify a filter to limit access e.g. to a branch.
 */
export function ghaOidcRole(stack: Stack, repo: { owner: string, repo?: string; filter?: string; }, openIdConnectProvider?: OpenIdConnectProvider): Role {
  return githubActions(stack).ghaOidcRole(repo, openIdConnectProvider);
}

/**
 * @deprecated - Use GithubActions instead
 *
 * A user for Gihud Actions CI/CD.
 */
export function ghaUser(stack: Stack, username?: string): { user: User, accessKey: CfnAccessKey | undefined; } {
  return githubActions(stack).ghaUser(username);
}
