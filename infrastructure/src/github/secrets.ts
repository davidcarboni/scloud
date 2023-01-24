import { existsSync, readFileSync } from 'fs';
import * as gh from './repo';

// Any Cludformation outputs that don't need to be added as GHA secrets:
const skipList = [
  'DevelopmentUserPool',
  'github',
];

// Any secrets to be added from environment variables passed to this script:
const shellEnvSecrets: string[] = [
  // 'SLACK_WEBHOOK',
];

// Values from /secrets/github.sh
const owner = process.env.OWNER || process.env.USERNAME || '';
const repo = process.env.REPO || '';

let repoSecrets: string[];

function readSecrets(): { [key: string]: string; } {
  const secrets: { [key: string]: string; } = {};

  const cdkOuputs = './secrets/cdk-outputs.json';
  // const awsConfig = '~/.aws/credentials';
  if (existsSync(cdkOuputs)) {
    const json = readFileSync(cdkOuputs, 'utf8').trim();
    const outputs = JSON.parse(json);
    const stackKeys = Object.keys(outputs);
    if (stackKeys.length === 1) {
      // Convert camel-case keys to env-var style for GH secret names:
      const keys = outputs[stackKeys[0]];
      Object.keys(keys).forEach((key: any) => {
        if (skipList.filter((skip) => key.startsWith(skip)).length > 0) {
          console.log(` x : ${key}`);
        } else {
          // https://stackoverflow.com/questions/54246477/how-to-convert-camelcase-to-snake-case-in-javascript
          // e.g. cfnOutputName -> CFN_OUTPUT_NAME
          const snakeCase: string = key.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
          const name = snakeCase.toUpperCase();
          const value = keys[key];
          secrets[name] = value;
        }
      });

      // Secrets from shell variables
      shellEnvSecrets.forEach((shellEnvSecret) => {
        secrets[shellEnvSecret] = process.env[shellEnvSecret] || '';
      });

      // Confirm the list of secrets to be set
      Object.keys(secrets).forEach((key) => {
        console.log(` - ${key}`);
      });
      console.log(`(${Object.keys(secrets).length})`);

      // Work out whether there are any "leftover" secrets on the repo that we've not got values for
      repoSecrets = repoSecrets.filter((item) => !Object.keys(secrets).includes(item));

      return secrets;
    }
    throw new Error('No output keys found from CDK');
  }
  throw new Error(`Couldn't find file ${cdkOuputs}`);
}

(async () => {
  console.log(`Updating secrets on ${owner}/${repo}`);
  try {
    // Cache the repo public key
    await gh.getRepoPublicKey(owner, repo);

    // List the current secrets
    repoSecrets = await gh.listRepoSecrets(owner, repo);
    console.log(`${owner}/${repo} has ${repoSecrets.length} secrets: ${repoSecrets}`);

    // Parse the input json
    const secrets = readSecrets();
    if (repoSecrets.length > 0) {
      console.log(` * NB: Some secrets were not included in the CloudFormation outputs (${repoSecrets.length}):`);
      repoSecrets.forEach((secretName) => {
        console.log(` - ${secretName}`);
        // Uncomment this to delete unrecognised secrets:
        gh.deleteSecret(secretName, owner, repo);
      });
    }

    // Github secrets
    const promises: Promise<string>[] = [];
    Object.keys(secrets).forEach((secretName) => {
      const promise = gh.setSecret(secretName, secrets[secretName], owner, repo);
      promises.push(promise);
    });
    const result = await Promise.all(promises);
    console.log(`Set ${result.length} secrets: ${JSON.stringify(result)}`);

    // TODO: Delete "leftover" secrets?

    // Useful for debugging secret values being passed to Github:
    // writeFileSync('./secrets/gha_secrets.txt', JSON.stringify(secrets));
  } catch (err) {
    console.error(err);
    throw err;
  }
})();

// octokit.rest.actions.createRepoVariable({
//   owner,
//   repo,
//   name,
//   value,
// });
