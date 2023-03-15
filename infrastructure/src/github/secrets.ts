import { existsSync, readFileSync, writeFileSync } from 'fs';
import * as gh from './repo';

const stacks : Record<string, string> = {
  CalculatorProduction: 'production',
  CalculatorStaging: 'staging',
};

// Values from /secrets/github.sh
const owner = process.env.OWNER || process.env.USERNAME || '';
const repo = process.env.REPO || '';
if (!owner) throw new Error('No repo owner: please set an environment variable for either USERNAME or OWNER');
if (!repo) throw new Error('No repo: please set an environment variable for REPO');

interface KeyValues {
  [name: string]: string
}

function envVarCase(camelCaseName: string): string {
  const snakeCase: string = camelCaseName.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
  return snakeCase.toUpperCase();
}

async function readVariables(): Promise<{repoVariables:KeyValues, environmentVariables: {[environment:string]: KeyValues}}> {
  const variables: {repoVariables:KeyValues, environmentVariables: {[environment:string]: KeyValues}} = { repoVariables: {}, environmentVariables: {} };

  const cdkOutputs = 'secrets/cdk-outputs.json';
  // const awsConfig = '~/.aws/credentials';
  if (existsSync(cdkOutputs)) {
    const json = readFileSync(cdkOutputs, 'utf-8').trim();
    const outputs = JSON.parse(json);
    const stackNames = Object.keys(outputs);
    if (stackNames.length > 0) {
      await Promise.all(stackNames.map(async (stackName) => {
        if (existsSync(`secrets/${stackName}.ghaVariables.json`)) {
          const variableNames = JSON.parse(readFileSync(`secrets/${stackName}.ghaVariables.json`, 'utf-8')) as string[];

          const environment = stacks[stackName];
          if (environment) { variables.environmentVariables[environment] = {}; }
          variableNames.forEach((variableName) => {
            if (environment) {
              variables.environmentVariables[environment][envVarCase(variableName)] = outputs[stackName][variableName];
            } else {
              variables.repoVariables[envVarCase(variableName)] = outputs[stackName][variableName];
            }
          });
        } else {
          console.log('variables file does not exist');
        }
      }));

      return variables;
    }
    throw new Error('No output keys found from CDK');
  }
  throw new Error(`Couldn't find file ${cdkOutputs}`);
}

async function readSecrets(): Promise<{repoSecrets:KeyValues, environmentSecrets: {[environment:string]: KeyValues}}> {
  const secrets: {repoSecrets:KeyValues, environmentSecrets: {[environment:string]: KeyValues}} = { repoSecrets: {}, environmentSecrets: {} };

  const cdkOutputs = 'secrets/cdk-outputs.json';
  // const awsConfig = '~/.aws/credentials';
  if (existsSync(cdkOutputs)) {
    const json = readFileSync(cdkOutputs, 'utf-8').trim();
    const outputs = JSON.parse(json);
    const stackNames = Object.keys(outputs);
    if (stackNames.length > 0) {
      await Promise.all(stackNames.map(async (stackName) => {
        if (existsSync(`secrets/${stackName}.ghaSecrets.json`)) {
          const secretNames = JSON.parse(readFileSync(`secrets/${stackName}.ghaSecrets.json`, 'utf-8')) as string[];

          const environment = stacks[stackName];
          if (environment) { secrets.environmentSecrets[environment] = {}; }
          secretNames.forEach((secretName) => {
            if (environment) {
              secrets.environmentSecrets[environment][envVarCase(secretName)] = outputs[stackName][secretName];
            } else {
              secrets.repoSecrets[envVarCase(secretName)] = outputs[stackName][secretName];
            }
          });
        } else {
          console.log('secrets file does not exist');
        }
      }));

      return secrets;
    }
    throw new Error('No output keys found from CDK');
  }
  throw new Error(`Couldn't find file ${cdkOutputs}`);
}

(async () => {
  console.log(`Updating variables and secrets on ${owner}/${repo}`);
  try {
    // Cache the repo public key
    await gh.getRepoPublicKey(owner, repo);

    const currentSecretNames: {
      repoSecrets:string[],
      environmentSecrets: {[environment:string]:string[]},
    } = {
      repoSecrets: [],
      environmentSecrets: {},
    };

    const currentVariableNames: {
      repoVariables:string[],
      environmentVariables: {[environment:string]:string[]}
    } = {
      repoVariables: [],
      environmentVariables: {},
    };

    // List the current secrets
    currentSecretNames.repoSecrets = await gh.listRepoSecrets(owner, repo);
    console.log(`${owner}/${repo} has ${currentSecretNames.repoSecrets.length} secrets: ${currentSecretNames.repoSecrets}`);

    await Promise.all(Object.keys(stacks).map(async (stackName) => {
      const environment = stacks[stackName];
      const envSecrets = await gh.listEnvironmentSecrets(owner, repo, environment);
      currentSecretNames.environmentSecrets[environment] = envSecrets;
      console.log(`${owner}/${repo}/${environment} has ${envSecrets.length} secrets: ${envSecrets}`);
    }));

    // List the current variables
    currentVariableNames.repoVariables = await gh.listRepoVariables(owner, repo);
    console.log(`${owner}/${repo} has ${currentVariableNames.repoVariables.length} variables: ${currentVariableNames.repoVariables}`);

    await Promise.all(Object.keys(stacks).map(async (stackName) => {
      const environment = stacks[stackName];
      const envVars = await gh.listEnvironmentVariables(owner, repo, environment);
      currentVariableNames.environmentVariables[environment] = envVars;
      console.log(`${owner}/${repo}/${environment} has ${envVars.length} variables: ${envVars}`);
    }));

    // Parse the input json (read the secrets and variables that we intend to set on the repo and environments)
    const newSecrets = await readSecrets();
    const newVariables = await readVariables();

    // Confirm the list of variables to be set
    console.log(`Variables to be set: ${JSON.stringify(newVariables, null, 2)}`);
    console.log('Not displaying secrets to be set because they are secret');

    // Calculate any leftover secrets or variables (existing in GHA but not in our infrastructure code)
    const leftoverSecretNames = {
      repoSecrets: <string[]>[],
      environmentSecrets: <{[environment:string]:string[]}>{},
    };

    leftoverSecretNames.repoSecrets = currentSecretNames.repoSecrets.filter((item) => !Object.keys(newSecrets.repoSecrets).includes(item));
    Object.keys(currentSecretNames.environmentSecrets).forEach((environment) => {
      leftoverSecretNames.environmentSecrets[environment] = currentSecretNames.environmentSecrets[environment].filter(
        (item) => !Object.keys(newSecrets.environmentSecrets[environment]).includes(item),
      );
    });

    const leftoverVariableNames = {
      repoVariables: <string[]>[],
      environmentVariables: <{[environment:string]:string[]}>{},
    };

    leftoverVariableNames.repoVariables = currentVariableNames.repoVariables.filter((item) => !Object.keys(newVariables.repoVariables).includes(item));
    Object.keys(currentVariableNames.environmentVariables).forEach((environment) => {
      leftoverVariableNames.environmentVariables[environment] = currentVariableNames.environmentVariables[environment].filter(
        (item) => !Object.keys(newVariables.environmentVariables[environment]).includes(item),
      );
    });

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

    // List out any leftover variables
    if (leftoverVariableNames.repoVariables.length > 0) {
      console.log(` * NB: Some repo variables were not included in the CloudFormation outputs (${leftoverVariableNames.repoVariables.length}):`);
      leftoverVariableNames.repoVariables.forEach((variableName) => console.log(` - ${variableName}`));
    }
    Object.keys(leftoverVariableNames.environmentVariables).forEach((environment) => {
      if (leftoverVariableNames.environmentVariables[environment].length > 0) {
        console.log(` * NB: Some environment variables in ${environment} were not included in the CloudFormation outputs (${leftoverVariableNames.environmentVariables[environment].length}):`);
        const environmentVariables = leftoverVariableNames.environmentVariables[environment];
        environmentVariables.forEach((variableName) => console.log(` - ${variableName}`));
      }
    });

    // Delete any leftover secrets
    await Promise.all(leftoverSecretNames.repoSecrets.map(async (secretName) => gh.deleteRepoSecret(secretName, owner, repo)));
    await Promise.all(Object.keys(leftoverSecretNames.environmentSecrets).map(async (environment) => {
      const environmentSecrets = leftoverSecretNames.environmentSecrets[environment];
      await Promise.all(environmentSecrets.map(async (secretName) => gh.deleteEnvironmentSecret(secretName, owner, repo, environment)));
    }));

    // Delete any leftover variables
    await Promise.all(leftoverVariableNames.repoVariables.map(async (variableName) => gh.deleteRepoVariable(variableName, owner, repo)));
    await Promise.all(Object.keys(leftoverVariableNames.environmentVariables).map(async (environment) => {
      const environmentVariables = leftoverVariableNames.environmentVariables[environment];
      await Promise.all(environmentVariables.map(async (secretName) => gh.deleteEnvironmentVariable(secretName, owner, repo, environment)));
    }));

    // Set secrets
    await Promise.all(Object.keys(newSecrets.repoSecrets).map(async (secretName) => gh.setRepoSecret(secretName, newSecrets.repoSecrets[secretName], owner, repo)));
    await Promise.all(Object.keys(newSecrets.environmentSecrets).map(async (environment) => {
      const environmentSecrets = newSecrets.environmentSecrets[environment];
      Object.keys(environmentSecrets).map(async (secretName) => gh.setEnvironmentSecret(secretName, environmentSecrets[secretName], owner, repo, environment));
    }));

    // Set variables
    await Promise.all(Object.keys(newVariables.repoVariables).map(async (variableName) => gh.setRepoVariable(variableName, newVariables.repoVariables[variableName], owner, repo)));
    await Promise.all(Object.keys(newVariables.environmentVariables).map(async (environment) => {
      const environmentVariables = newVariables.environmentVariables[environment];
      Object.keys(environmentVariables).map(async (variableName) => gh.setEnvironmentVariable(variableName, environmentVariables[variableName], owner, repo, environment));
    }));

    // Useful for debugging secret values being passed to Github:
    writeFileSync('secrets/gha_secrets.txt', JSON.stringify(newSecrets, null, 2));
    writeFileSync('secrets/gha_variables.txt', JSON.stringify(newVariables, null, 2));
  } catch (err) {
    console.error(err);
    throw err;
  }
})();
