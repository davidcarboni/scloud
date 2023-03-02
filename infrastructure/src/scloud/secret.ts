import { Stack } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

/**
 * Generates a simple secret value.
 * see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_secretsmanager-readme.html
 * @param stack The stack is used as the parent Construct and the stack name is used as a prefix in the secret name
 * @param name The name for the secret, which will also populate the description for readability
 * @returns A simple secret. The value can be accessed as
 */
export function secretValue(stack: Stack, name: string): Secret {
  return new Secret(stack, `${stack.stackName}/${name}`, {
    description: name,
  });
}

/**
 * Generates an object secret value, potionally adding a key with a generated secret value
 * (e.g. you might provide a template that includes a value for 'username' and specify generateStringKey as 'password').
 * see: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_secretsmanager-readme.html
 * @param stack The stack is used as the parent Construct and the stack name is used as a prefix in the secret name
 * @param name The name for the secret, which will also populate the description for readability
 * @param template The non-secret values to include in the secret json object
 * @param generateStringKey The object key to add that will contain a generated secret (defaults to undefined to not generate a secret value)
 * @returns A simple secret. The value can be accessed as
 */
export function secretObject(stack: Stack, name: string, template: Record<string, string> = {}, generateStringKey:string|undefined = undefined): Secret {
  return new Secret(stack, `${stack.stackName}/${name}`, {
    description: name,
    generateSecretString: {
      secretStringTemplate: JSON.stringify(template),
      generateStringKey,
    },
  });
}
