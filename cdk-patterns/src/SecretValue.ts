import { Stack } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Generates a secret value.
 * see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_secretsmanager-readme.html
 * @param scope The name of the parent construct's stack is used as a prefix in the secret name
 * @returns A simple secret. The value can be accessed as SecretValue.secretValue
 */
export class SecretValue extends Secret {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      description: `${Stack.of(scope).stackName}/${id}`,
    });
  }
}
