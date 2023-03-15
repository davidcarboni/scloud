import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { CfnOutput } from 'aws-cdk-lib';
import { addGhaVariable, GhaInfo } from './ghaUser';

/**
 * An API gateway backed by a Lambda function.
 * @param construct Parent CDK construct (typically 'this')
 * @param name The name for this repository
 * @returns The created repository
 */
export default function ecrRepository(
  construct: Construct,
  name: string,
  ghaInfo: GhaInfo,
): Repository {
  // Repository
  const repository = new ecr.Repository(construct, `${name}Repository`, {
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  // CfnOutput in the format: ecrName
  const repoOutputName = `ecr${name[0].toUpperCase()}${name.toLowerCase().slice(1)}`;
  addGhaVariable(new CfnOutput(construct, repoOutputName, { value: repository.repositoryName }), ghaInfo);

  return repository;
}
