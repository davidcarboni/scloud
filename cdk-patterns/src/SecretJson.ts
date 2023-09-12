import { Stack } from 'aws-cdk-lib';
import { Secret, SecretStringGenerator } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Generates a secret value from a template.
 * see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_secretsmanager-readme.html
 * @param scope The name of the parent construct's stack is used as a prefix in the secret name
 * @param template A json object containing keys and values to be used in the secret
 * @param generator Allows you to override defaults for secret generation, e.g. you can set passwordLength
 * @param generateStringKey A key in the resulting secret whose value will autonatically be generated according to any values passed in the generator parameter
 * @returns A json secret. The values of the keys in the template can be accessed as SecretJson.secretValueFromJson(key)
 */
export class SecretJson extends Secret {
  constructor(scope: Construct, id: string, template: Record<string, string>, generateStringKey?: string, generator?: Partial<SecretStringGenerator>) {
    super(scope, id, {
      description: `${Stack.of(scope).stackName}/${id}`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify(template),
        generateStringKey: generateStringKey || 'password',
        ...generator,
      },
    });
  }
}
