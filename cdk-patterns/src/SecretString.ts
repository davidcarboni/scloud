import { SecretValue, Stack } from 'aws-cdk-lib';
import { Secret, SecretProps } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * WARNING: Not recommended for sensitive data.
 * 
 * From the AWS docs: The secret string will be included in the output of the cdk as part of synthesis, and will appear in the CloudFormation template in the console. It will be visible to anyone with access to the CloudFormation template (via the AWS Console, SDKs, or CLI).
 * 
 * Generates a secret value from a plain-text string.
 * 
 * see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_secretsmanager-readme.html
 * @param scope The name of the parent construct's stack is used as a prefix in the secret name
 * @returns A simple secret. The value can be accessed as SecretValue.secretValue
 */
export class SecretString extends Secret {
  constructor(scope: Construct, id: string, props: { secretValue: string, secretProps?: Partial<SecretProps>; }) {
    super(scope, id, {
      description: `${Stack.of(scope).stackName}/${id}`,
      secretStringValue: SecretValue.unsafePlainText(props.secretValue),
      ...props.secretProps,
    });
  }
}
