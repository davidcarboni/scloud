import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
  deleteEnvironmentSecret, deleteEnvironmentVariable, listEnvironmentSecrets, listEnvironmentVariables, setEnvironmentSecret, setEnvironmentVariable,
} from './environment';
import {
  deleteRepoSecret, deleteRepoVariable, listRepoSecrets, listRepoVariables, setRepoSecret, setRepoVariable,
} from './repo';

//
// Delete "leftover" secrets and variables?
//
// Pass --delete on the command line. Keeps things tidy, but will also delete any secrets or variables you've set manually
//
const deleteLeftoverValues = process.argv.includes('--delete');

//
// Values from /secrets/github.sh:
//
// export USERNAME=octocat
// export PERSONAL_ACCESS_TOKEN=xxxxxxxxxxx
// export OWNER=organization
// export REPO=repository
const owner = process.env.OWNER || process.env.USERNAME || '';
const repo = process.env.REPO || '';
if (!owner) throw new Error('No repo owner: please set an environment variable for either USERNAME or OWNER');
if (!repo) throw new Error('No repo: please set an environment variable for REPO');

//
// Optional: map stack name(s) to Github environment name(s)
//
// secrets/environmentMappings.json:
// {
//    "StackName": "ghithubEnvironmentName"
// }
//
// If this isn't set, stack variables/secrets will be set at the repo level.
let environmentMappings: Record<string, string> = {};
const environmentMappingsFile = 'secrets/environmentMappings.json';
if (existsSync(environmentMappingsFile)) {
  const json = readFileSync(environmentMappingsFile, 'utf-8');
  environmentMappings = JSON.parse(json);
}

// Type-checking interfaces that represent collections of variable/secret key-value pairs
interface KeyValues {
  [name: string]: string;
}
interface KeyValuesCollection {
  repo: KeyValues, environment: { [environment: string]: KeyValues; };
}
interface KeysCollection {
  repo: string[], environment: { [environment: string]: string[]; };
}

function envVarCase(camelCaseName: string): string {
  const snakeCase: string = camelCaseName.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
  return snakeCase.toUpperCase();
}

async function readVariables(): Promise<KeyValuesCollection> {
  const variables: KeyValuesCollection = { repo: {}, environment: {} };

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

          const environment = environmentMappings[stackName];
          if (environment) { variables.environment[environment] = {}; }
          variableNames.forEach((variableName) => {
            if (environment) {
              variables.environment[environment][envVarCase(variableName)] = outputs[stackName][variableName];
            } else {
              variables.repo[envVarCase(variableName)] = outputs[stackName][variableName];
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

async function readSecrets(): Promise<KeyValuesCollection> {
  const secrets: KeyValuesCollection = { repo: {}, environment: {} };

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

          const environment = environmentMappings[stackName];
          if (environment) { secrets.environment[environment] = {}; }
          secretNames.forEach((secretName) => {
            if (environment) {
              secrets.environment[environment][envVarCase(secretName)] = outputs[stackName][secretName];
            } else {
              secrets.repo[envVarCase(secretName)] = outputs[stackName][secretName];
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

/**
 * Handles synching variables with Github
 */
async function processVariables(): Promise<KeyValuesCollection> {
  const currentVariableNames: KeysCollection = {
    repo: [],
    environment: {},
  };

  // List the current variables
  currentVariableNames.repo = await listRepoVariables(owner, repo);
  console.log(`${owner}/${repo} has ${currentVariableNames.repo.length} variables: ${currentVariableNames.repo}`);

  await Promise.all(Object.keys(environmentMappings).map(async (stackName) => {
    const environment = environmentMappings[stackName];
    const envVars = await listEnvironmentVariables(owner, repo, environment);
    currentVariableNames.environment[environment] = envVars;
    console.log(`${owner}/${repo}/${environment} has ${envVars.length} variables: ${envVars}`);
  }));

  // Parse the input json (read the variables that we intend to set on the repo and environments)
  const newVariables = await readVariables();

  // Confirm the list of variables to be set
  console.log(`Variables to be set: ${JSON.stringify(newVariables, null, 2)}`);

  const leftoverVariableNames = {
    repo: <string[]>[],
    environment: <{ [environment: string]: string[]; }>{},
  };

  leftoverVariableNames.repo = currentVariableNames.repo.filter((item) => !Object.keys(newVariables.repo).includes(item));
  Object.keys(currentVariableNames.environment).forEach((environment) => {
    leftoverVariableNames.environment[environment] = currentVariableNames.environment[environment].filter(
      (item) => !Object.keys(newVariables.environment[environment]).includes(item),
    );
  });

  // List out any leftover variables
  if (leftoverVariableNames.repo.length > 0) {
    console.log(` * NB: Some repo variables were not included in the CloudFormation outputs (${leftoverVariableNames.repo.length}):`);
    leftoverVariableNames.repo.forEach((variableName) => console.log(` - ${variableName}`));
  }
  Object.keys(leftoverVariableNames.environment).forEach((environment) => {
    if (leftoverVariableNames.environment[environment].length > 0) {
      console.log(` * NB: Some environment variables in ${environment} were not included in the CloudFormation outputs (${leftoverVariableNames.environment[environment].length}):`);
      const environmentVariables = leftoverVariableNames.environment[environment];
      environmentVariables.forEach((variableName) => console.log(` - ${variableName}`));
    }
  });

  // Delete any leftover variables
  await Promise.all(leftoverVariableNames.repo.map(async (variableName) => deleteRepoVariable(variableName, owner, repo)));
  await Promise.all(Object.keys(leftoverVariableNames.environment).map(async (environment) => {
    const environmentVariables = leftoverVariableNames.environment[environment];
    await Promise.all(environmentVariables.map(async (secretName) => deleteEnvironmentVariable(secretName, owner, repo, environment)));
  }));

  // Set variables
  await Promise.all(Object.keys(newVariables.repo).map(async (variableName) => setRepoVariable(
    variableName,
    newVariables.repo[variableName],
    owner,
    repo,
  )));
  await Promise.all(Object.keys(newVariables.environment).map(async (environment) => {
    const environmentVariables = newVariables.environment[environment];
    Object.keys(environmentVariables).map(async (variableName) => setEnvironmentVariable(
      variableName,
      environmentVariables[variableName],
      owner,
      repo,
      environment,
    ));
  }));

  return newVariables;
}

/**
 * Handles synching secrets with Github
 */
async function processSecrets(): Promise<KeyValuesCollection> {
  const currentSecretNames: KeysCollection = {
    repo: [],
    environment: {},
  };

  // List the current secrets
  currentSecretNames.repo = await listRepoSecrets(owner, repo);
  console.log(`${owner}/${repo} has ${currentSecretNames.repo.length} secrets: ${currentSecretNames.repo}`);

  await Promise.all(Object.keys(environmentMappings).map(async (stackName) => {
    const environment = environmentMappings[stackName];
    const envSecrets = await listEnvironmentSecrets(owner, repo, environment);
    currentSecretNames.environment[environment] = envSecrets;
    console.log(`${owner}/${repo}/${environment} has ${envSecrets.length} secrets: ${envSecrets}`);
  }));

  // Parse the input json (read the secrets that we intend to set on the repo and environments)
  const newSecrets = await readSecrets();

  const newSecretNames: KeysCollection = { repo: [], environment: {} };
  newSecretNames.repo = Object.keys(newSecrets.repo);
  Object.keys(newSecrets.environment).forEach((environment) => {
    newSecretNames.environment[environment] = Object.keys(newSecrets.environment[environment]);
  });
  console.log(`Secrets (names) to be set: ${JSON.stringify(newSecretNames, null, 2)}`);

  // Calculate any leftover secrets or variables (existing in GHA but not in our infrastructure code)
  const leftoverSecretNames = {
    repo: <string[]>[],
    environment: <{ [environment: string]: string[]; }>{},
  };

  leftoverSecretNames.repo = currentSecretNames.repo.filter((item) => !Object.keys(newSecrets.repo).includes(item));
  Object.keys(currentSecretNames.environment).forEach((environment) => {
    leftoverSecretNames.environment[environment] = currentSecretNames.environment[environment].filter(
      (item) => !Object.keys(newSecrets.environment[environment]).includes(item),
    );
  });

  // List out any leftover secrets
  let leftover = false;
  if (leftoverSecretNames.repo.length > 0) {
    console.log(` * NB: Some repo secrets were not included in the CloudFormation outputs (${leftoverSecretNames.repo.length}):`);
    leftoverSecretNames.repo.forEach((secretName) => console.log(` - ${secretName}`));
    leftover = true;
  }
  Object.keys(leftoverSecretNames.environment).forEach((environment) => {
    if (leftoverSecretNames.environment[environment].length > 0) {
      console.log(` * NB: Some environment secrets in ${environment} were not included in the CloudFormation outputs (${leftoverSecretNames.environment[environment].length}):`);
      const environmentSecrets = leftoverSecretNames.environment[environment];
      environmentSecrets.forEach((secretName) => console.log(` - ${secretName}`));
    }
  });

  // Delete leftover secrets - keeps things clean and tidy
  if (deleteLeftoverValues) {
    await Promise.all(leftoverSecretNames.repo.map(async (secretName) => deleteRepoSecret(secretName, owner, repo)));
    await Promise.all(Object.keys(leftoverSecretNames.environment).map(async (environment) => {
      const environmentSecrets = leftoverSecretNames.environment[environment];
      await Promise.all(environmentSecrets.map(async (secretName) => deleteEnvironmentSecret(secretName, owner, repo, environment)));
    }));
  } else if (leftover) console.log('(Not deleted - pass "--delete" to tidy up these values)');

  // Set secrets
  await Promise.all(Object.keys(newSecrets.repo).map(async (secretName) => setRepoSecret(
    secretName,
    newSecrets.repo[secretName],
    owner,
    repo,
  )));
  await Promise.all(Object.keys(newSecrets.environment).map(async (environment) => {
    const environmentSecrets = newSecrets.environment[environment];
    Object.keys(environmentSecrets).map(async (secretName) => setEnvironmentSecret(
      secretName,
      environmentSecrets[secretName],
      owner,
      repo,
      environment,
    ));
  }));

  return newSecrets;
}

(async () => {
  console.log(`Updating variables and secrets on ${owner}/${repo}`);
  try {
    const newVariables = await processVariables();
    const newSecrets = await processSecrets();

    // Useful for debugging secret values being passed to Github:
    writeFileSync('secrets/gha_secrets.txt', JSON.stringify(newSecrets, null, 2));
    writeFileSync('secrets/gha_variables.txt', JSON.stringify(newVariables, null, 2));
  } catch (err) {
    console.error(err);
    throw err;
  }
})();
