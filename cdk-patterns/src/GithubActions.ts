/* eslint-disable no-param-reassign */
import * as fs from 'fs';
import {
  CfnAccessKey, ManagedPolicy, OpenIdConnectProvider, PolicyStatement, Role, User, WebIdentityPrincipal,
} from 'aws-cdk-lib/aws-iam';
import { CfnOutput, Stack } from 'aws-cdk-lib';
import { IRepository } from 'aws-cdk-lib/aws-ecr';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { IFargateService } from 'aws-cdk-lib/aws-ecs';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import _ from 'lodash';

/**
 * To use this construct, call the githubActions() function to get a singleton instance.
 *
 * You'l want to call one of these two methods:
 * - ghaOidcRole: If you'd like to use keyless access to AWS resources from GitHub Actions.
 * NB you'll need an OIDC provider set up in the accout.
 * You can create one by calling ghaOidcProvider() or by creating one manually.
 * - ghaUser If you'd like to use an IAM user with an access key to access AWS resources from GitHub Actions.
 * The access key and secret access key will be output so you can add them GitHub Actions Secrets.
 *
 * A Construct that helps integrate GitHub Actions for deploying to AWS
 */
class GithubActions extends Construct {
  // Using 'this.scope' for the parent because using 'this' creates longer names.
  scope: Construct;

  stackName: string;

  account: string;

  policy: ManagedPolicy;

  ghaInfo = {
    resources: {
      repositories: <IRepository[]>[],
      buckets: <IBucket[]>[],
      lambdas: <IFunction[]>[],
      services: <IFargateService[]>[],
      distributions: <IDistribution[]>[],
    },
    secrets: <string[]>[],
    variables: <string[]>[],
  };

  constructor(
    scope: Construct,
  ) {
    super(scope, 'GithubActions');
    this.stackName = Stack.of(scope).stackName;
    this.account = Stack.of(scope).account;
    this.scope = scope;
  }

  addGhaSecret(
    name: string,
    value: string,
  ) {
    const cfnOutput = new CfnOutput(this.scope, name, { value });
    this.ghaInfo.secrets.push(cfnOutput.node.id);
  }

  addGhaVariable(
    name: string,
    type: string,
    value: string,
  ) {
    const variableName = `${_.lowerFirst(name)}${_.capitalize(type)}`;
    const cfnOutput = new CfnOutput(this.scope, variableName, { value });
    this.ghaInfo.variables.push(cfnOutput.node.id);
  }

  addGhaLambda(
    name: string,
    lambda: IFunction,
  ) {
    this.ghaInfo.resources.lambdas.push(lambda);
    this.addGhaVariable(name, 'lambda', lambda.functionName);
  }

  addGhaBucket(
    name: string,
    bucket: IBucket,
  ) {
    this.ghaInfo.resources.buckets.push(bucket);
    this.addGhaVariable(name, 'bucket', bucket.bucketName);
  }

  addGhaDistribution(
    name: string,
    distribution: IDistribution,
  ) {
    this.ghaInfo.resources.distributions.push(distribution);
    this.addGhaVariable(name, 'distributionId', distribution.distributionId);
  }

  addGhaRepository(
    name: string,
    repository: IRepository,
  ) {
    this.ghaInfo.resources.repositories.push(repository);
    this.addGhaVariable(name, 'repository', repository.repositoryName);
  }

  ghaPolicy() {
    if (!this.policy) {
      const name = `gha-${this.stackName}-policy`;
      this.policy = new ManagedPolicy(this.scope, name, {
        managedPolicyName: name,
      });

      // ECR repositories - push/pull images
      const repositoryArns = this.ghaInfo.resources.repositories
        .filter((repository) => repository)
        .map((repository) => repository.repositoryArn);
      if (repositoryArns.length > 0) {
        this.addToPolicy('ecrLogin', ['*'], ['ecr:GetAuthorizationToken']);
        this.addToPolicy('ecrRepositories', repositoryArns, [
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
      }
      // Buckets - upload/sync
      const bucketArns = this.ghaInfo.resources.buckets
        .filter((bucket) => bucket)
        .map((bucket) => bucket.bucketArn);
      this.addToPolicy('buckets', bucketArns, [
        's3:ListBucket',
      ]);
      const bucketObjectsArns = bucketArns.map((arn) => `${arn}/*`);
      this.addToPolicy('bucketObjects', bucketObjectsArns, [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
      ]);

      // Lambdas - update update with a new zip/container build
      const lambdaArns = this.ghaInfo.resources.lambdas
        .filter((lambda) => lambda)
        .map((lambda) => lambda.functionArn);
      this.addToPolicy('lambdas', lambdaArns, [
        'lambda:UpdateFunctionCode',
        // 'lambda:PublishVersion',
      ]);

      // Fargate services - update with a new container build
      const serviceArns = this.ghaInfo.resources.services
        .filter((service) => service)
        .map((service) => service.serviceArn);
      this.addToPolicy('fargateServices', serviceArns, [
        'ecs:UpdateService',
      ]);

      // Cloudfront distribution - cache invalidation
      const distributionArns = this.ghaInfo.resources.distributions
        .filter((distribution) => distribution !== undefined)
        // Not sure where to 'properly' get a distribution ARN from?
        .map((distribution) => `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`);
      this.addToPolicy('distributions', distributionArns, [
        'cloudfront:CreateInvalidation',
      ]);
    }

    return this.policy;
  }

  addToPolicy(name: string, resources: string[], actions: string[]) {
    if (resources.length > 0) {
      this.policy.addStatements(new PolicyStatement({
        actions,
        resources,
        sid: name,
      }));
    }
  }

  /**
   * Create an account-wide OIDC connection fo Guthub Actions.
   *
   * NB only one OIDC provider for GitHub can be created per AWS account (because the provider URL must be unique).
   *
   * To provide access to resources, you can create multiple roles that trust the provider so you'll probably want to call ghaOidcRole() instead.
   * See: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
   * @param repo What to grant access to. This is a minimum of a GitHub owner (user or org), optionally a repository name, and you can also specify a filter to limit access to e.g. a branch.
   */
  ghaOidcProvider(): OpenIdConnectProvider {
    return new OpenIdConnectProvider(this.scope, 'oidc-provider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });
  }

  /**
   * Add permissions to the GitHub OIDC role that allow workflows to access the AWS resources in this stack that need to be updated at build time.
   * See: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
   * @param repo The repository to grant access to (owner and name). You can also specify a filter to limit access e.g. to a branch.
   */
  ghaOidcRole(repo: { owner: string, repo?: string; filter?: string; }, openIdConnectProvider?: OpenIdConnectProvider): Role {
    const provider = openIdConnectProvider || OpenIdConnectProvider.fromOpenIdConnectProviderArn(this.scope, `oidc-provider-${this.account}`, `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`);

    // Grant only requests coming from the specific owner/repository/filter to assume this role.
    const role = new Role(this.scope, `gha-oidc-role-${this.stackName}`, {
      assumedBy: new WebIdentityPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringLike: {
            'token.actions.githubusercontent.com:sub': [`repo:${repo.owner}/${repo.repo}:${repo.filter || '*'}`],
          },
        },
      ),
      managedPolicies: [
        this.ghaPolicy(),
      ],
      roleName: `gha-oidc-${this.stackName}`,
      description: `Role for GitHub Actions to assume when deploying to ${this.stackName}`,
    });
    this.addGhaVariable('ghaOidc', 'Role', role.roleArn);

    this.saveGhaValues();
    return role;
  }

  /**
 * A user for Gihud Actions CI/CD.
 */
  ghaUser(username?: string): { user: User, accessKey: CfnAccessKey | undefined; } {
    // A user with the policy attached
    const user = new User(this.scope, 'ghaUser', { userName: username || `gha-${this.stackName}` });
    const policy = this.ghaPolicy();
    user.addManagedPolicy(policy);

    // Credentials
    let accessKey: CfnAccessKey | undefined;
    if (!process.env.REKEY) {
      accessKey = new CfnAccessKey(this.scope, 'ghaUserAccessKey', {
        userName: user.userName,
      });

      // Access key details for GHA secrets
      this.addGhaSecret('awsAccessKeyId', accessKey.ref);
      this.addGhaSecret('awsSecretAccessKey', accessKey.attrSecretAccessKey);
    }

    this.saveGhaValues();
    return { user, accessKey };
  }

  saveGhaValues() {
    if (fs.existsSync('secrets')) {
      // Write out the list of secret and variable names:
      fs.writeFileSync(`secrets/${this.stackName}.ghaSecrets.json`, JSON.stringify(this.ghaInfo.secrets));
      fs.writeFileSync(`secrets/${this.stackName}.ghaVariables.json`, JSON.stringify(this.ghaInfo.variables));
    }

    // Flush ghaInfo so we're free to build another stack if needed:
    this.ghaInfo.resources.buckets = [];
    this.ghaInfo.resources.distributions = [];
    this.ghaInfo.resources.lambdas = [];
    this.ghaInfo.resources.repositories = [];
    this.ghaInfo.resources.services = [];
    this.ghaInfo.secrets = [];
    this.ghaInfo.variables = [];
  }
}

export function githubActions(scope: Construct): GithubActions {
  // Find the existing instance in the stack, if present:
  const stack = Stack.of(scope);
  const existing = stack.node.tryFindChild('GithubActions');
  return existing as GithubActions || new GithubActions(scope);
}
