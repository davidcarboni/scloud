import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as gh from './repo';

// Any Cludformation outputs that don't need to be added as GHA secrets:
const skipList = [
  'queueArn',
  'metricsSenderPolicyArn',
  'githubWebhook',
  'ExportsOutput',
];

// Any secrets to be added from environment variables passed to this script:
const shellEnvSecrets: string[] = [
  // 'SLACK_WEBHOOK',
];

const stacks : Record<string, string> = {
  CalculatorProduction: 'production',
  CalculatorStaging: 'staging',
};

// Values from /secrets/github.sh
const owner = process.env.OWNER || process.env.USERNAME || '';
const repo = process.env.REPO || '';
if (!owner) throw new Error('No repo owner: please set an environment variable for either USERNAME or OWNER');
if (!repo) throw new Error('No repo: please set an environment variable for REPO');

const leftoverSecretNames: {repoSecrets:string[], environmentSecrets: Record<string, string[]>} = { repoSecrets: [], environmentSecrets: {} };

interface Secrets {
  [name: string]: string
}

function readSecrets(): {repoSecrets:Secrets, environmentSecrets: Record<string, Secrets>} {
  const secrets: {repoSecrets:Secrets, environmentSecrets: Record<string, Secrets>} = { repoSecrets: {}, environmentSecrets: {} };

  const cdkOutputs = 'secrets/cdk-outputs.json';
  // const awsConfig = '~/.aws/credentials';
  if (existsSync(cdkOutputs)) {
    const json = readFileSync(cdkOutputs, 'utf8').trim();
    const outputs = JSON.parse(json);
    const stackNames = Object.keys(outputs);
    if (stackNames.length > 0) {
      stackNames.forEach((stackName) => {
        const environmentName = stacks[stackName];
        secrets.environmentSecrets[environmentName] = {};
        // Convert camel-case keys to env-var style for GH secret names:
        const keys = outputs[stackName];
        Object.keys(keys).forEach((key: any) => {
          if (skipList.filter((skip) => key.startsWith(skip)).length > 0) {
            console.log(` x : ${key}`);
          } else {
          // https://stackoverflow.com/questions/54246477/how-to-convert-camelcase-to-snake-case-in-javascript
          // e.g. cfnOutputName -> CFN_OUTPUT_NAME
            const snakeCase: string = key.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
            const name = snakeCase.toUpperCase();
            const value = keys[key];
            if (environmentName) {
              secrets.environmentSecrets[environmentName][name] = value;
            } else {
              secrets.repoSecrets[name] = value;
            }
          }
        });
      });

      // Secrets from shell variables
      shellEnvSecrets.forEach((shellEnvSecret) => {
        secrets.repoSecrets[shellEnvSecret] = process.env[shellEnvSecret] || '';
      });

      // Confirm the list of secrets to be set
      console.log(`Secrets to be set: ${JSON.stringify(secrets, null, 2)}`);

      // Work out whether there are any "leftover" secrets on the repo that we've not got values for
      leftoverSecretNames.repoSecrets = leftoverSecretNames.repoSecrets.filter((item) => !Object.keys(secrets.repoSecrets).includes(item));
      Object.keys(leftoverSecretNames.environmentSecrets).forEach((environment) => {
        leftoverSecretNames.environmentSecrets[environment].filter((item) => !Object.keys(secrets.environmentSecrets[environment]).includes(item));
      });

      return secrets;
    }
    throw new Error('No output keys found from CDK');
  }
  throw new Error(`Couldn't find file ${cdkOutputs}`);
}

(async () => {
  console.log(`Updating secrets on ${owner}/${repo}`);
  try {
    // Cache the repo public key
    await gh.getRepoPublicKey(owner, repo);

    // List the current secrets
    leftoverSecretNames.repoSecrets = await gh.listRepoSecrets(owner, repo);
    console.log(`${owner}/${repo} has ${leftoverSecretNames.repoSecrets.length} secrets: ${leftoverSecretNames.repoSecrets}`);

    await Promise.all(Object.keys(stacks).map(async (stackName) => {
      const environment = stacks[stackName];
      leftoverSecretNames.environmentSecrets[environment] = await gh.listEnvironmentSecrets(owner, repo, environment);
    }));

    // Parse the input json
    const secrets = readSecrets();

    // List out any leftover secrets
    if (leftoverSecretNames.repoSecrets.length > 0) {
      console.log(` * NB: Some repo secrets were not included in the CloudFormation outputs (${leftoverSecretNames.repoSecrets.length}):`);
      leftoverSecretNames.repoSecrets.forEach((secretName) => console.log(` - ${secretName}`));
    }
    Object.keys(leftoverSecretNames.environmentSecrets).forEach((environment) => {
      if (leftoverSecretNames.environmentSecrets[environment].length > 0) {
        console.log(` * NB: Some environment secrets in ${environment} were not included in the CloudFormation outputs (${leftoverSecretNames.environmentSecrets[environment].length}):`);
        const environmentSecrets = leftoverSecretNames.environmentSecrets[environment];
        environmentSecrets.forEach((secretName) => console.log(` - ${secretName}`));
      }
    });

    // Delete any leftover secrets
    await Promise.all(leftoverSecretNames.repoSecrets.map(async (secretName) => gh.deleteRepoSecret(secretName, owner, repo)));
    await Promise.all(Object.keys(leftoverSecretNames.environmentSecrets).map(async (environment) => {
      const environmentSecrets = leftoverSecretNames.environmentSecrets[environment];
      await Promise.all(environmentSecrets.map(async (secretName) => gh.deleteEnvironmentSecret(secretName, owner, repo, environment)));
    }));

    // Set secrets
    await Promise.all(Object.keys(secrets.repoSecrets).map(async (secretName) => gh.setRepoSecret(secretName, secrets.repoSecrets[secretName], owner, repo)));
    await Promise.all(Object.keys(secrets.environmentSecrets).map(async (environment) => {
      const environmentSecrets = secrets.environmentSecrets[environment];
      Object.keys(environmentSecrets).map(async (secretName) => gh.setEnvironmentSecret(secretName, environmentSecrets[secretName], owner, repo, environment));
    }));

    // Useful for debugging secret values being passed to Github:
    writeFileSync('secrets/gha_secrets.txt', JSON.stringify(secrets, null, 2));
  } catch (err) {
    console.error(err);
    throw err;
  }
})();
