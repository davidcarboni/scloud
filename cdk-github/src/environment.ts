import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import encrypt from './encrypt';
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types';

const username = process.env.USERNAME;
const personalAccessToken = process.env.PERSONAL_ACCESS_TOKEN;

const octokit = new Octokit({
  auth: personalAccessToken,
  userAgent: username,
});

// See: https://github.com/octokit/types.ts
type EnvironmentPublicKey = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.actions.getEnvironmentPublicKey
>;

const environmentPublicKeys: Record<string, EnvironmentPublicKey> = {};

async function getRepoId(owner: string, repo: string) {
  return (await octokit.repos.get({ owner, repo })).data.id;
}

export async function getEnvironmentPublicKey(owner: string, repo: string, environment: string): Promise<EnvironmentPublicKey> {
  if (environmentPublicKeys[environment]) return environmentPublicKeys[environment];

  const repoId = await getRepoId(owner, repo);
  const parameters: RestEndpointMethodTypes['actions']['getEnvironmentPublicKey']['parameters'] = {
    repository_id: repoId,
    environment_name: environment,
  };
  const response = await octokit.actions.getEnvironmentPublicKey(parameters);

  if (response.status !== 200) {
    console.log(response);
    throw new Error('Error getting environment public key');
  }

  // Cache and return the result
  environmentPublicKeys[environment] = response.data;
  return environmentPublicKeys[environment];
}

export async function listEnvironmentSecrets(owner: string, repo: string, environment: string): Promise<string[]> {
  const parameters: RestEndpointMethodTypes['actions']['listEnvironmentSecrets']['parameters'] = {
    environment_name: environment,
    repository_id: await getRepoId(owner, repo),
    per_page: 100,
  };
  const response = await octokit.actions.listEnvironmentSecrets(parameters);

  if (response.status !== 200) {
    console.log(response);
    throw new Error(`Error listing environment secrets for ${environment}`);
  }

  const { secrets } = response.data;
  const totalCount = response.data.total_count;

  // Check we've got all the secrets
  if (totalCount > 100) {
    throw new Error('Too many environment secrets, TODO: need to paginate.');
  }

  // Collate secret names
  const names: string[] = [];
  secrets.forEach((secret) => {
    names.push(secret.name);
  });

  return names;
}

export async function listEnvironmentVariables(owner: string, repo: string, environment: string): Promise<string[]> {
  const parameters: RestEndpointMethodTypes['actions']['listEnvironmentVariables']['parameters'] = {
    environment_name: environment,
    repository_id: await getRepoId(owner, repo),
    per_page: 100,
  };
  const response = await octokit.actions.listEnvironmentVariables(parameters);

  if (response.status !== 200) {
    console.log(response);
    throw new Error(`Error listing environment variables for ${environment}`);
  }

  const { variables } = response.data;
  const totalCount = response.data.total_count;

  // Check we've got all the secrets
  if (totalCount > 100) {
    throw new Error('Too many environment variables, TODO: need to paginate.');
  }

  // Collate variable names
  const names: string[] = [];
  variables.forEach((variable) => {
    names.push(variable.name);
  });

  return names;
}

export async function setEnvironmentSecret(
  secretName: string,
  secretValue: string,
  owner: string,
  repo: string,
  environment: string,
): Promise<string> {
  if (!secretValue) throw new Error(`No value for environment secret ${secretName} (${owner}/${repo} - ${environment})`);
  const environmentPublicKey = await getEnvironmentPublicKey(owner, repo, environment);
  const encryptedValue = await encrypt(secretValue, environmentPublicKey.key);
  const repoId = await getRepoId(owner, repo);
  const parameters: RestEndpointMethodTypes['actions']['createOrUpdateEnvironmentSecret']['parameters'] = {
    environment_name: environment,
    repository_id: repoId,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: environmentPublicKey.key_id,
  };
  const response = await octokit.actions.createOrUpdateEnvironmentSecret(parameters);

  if (response.status === 201 || response.status === 204) {
    return secretName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error setting environment secret value: ${secretName}: status code ${response.status} - ${environment}`);
}

/**
 * Updates (or creates) a variable at the environment level within a repository.
 * @param name name of the variable
 * @param value value for the variable
 * @param owner Owner (or organisation) for the repository
 * @param repo Repository name
 * @param environment The name of the environment in this repo
 * @returns
 */
export async function setEnvironmentVariable(
  name: string,
  value: string,
  owner: string,
  repo: string,
  environment: string,
): Promise<string> {
  if (!value) throw new Error(`No value for environment variable ${name} (${owner}/${repo} - ${environment}))`);
  try {
    // Most likely we're updating an existing variable:
    const parameters: RestEndpointMethodTypes['actions']['updateEnvironmentVariable']['parameters'] = {
      environment_name: environment,
      repository_id: await getRepoId(owner, repo),
      name,
      value,
    };
    const response = await octokit.rest.actions.updateEnvironmentVariable(parameters);

    if (response.status === 204) {
      return name;
    }

    throw new Error(`Error setting environment variable value: ${name}: status code ${response.status} - ${environment}`);
  } catch (e) {
    // If not, we might be creating a new variable:
    const parameters: RestEndpointMethodTypes['actions']['createEnvironmentVariable']['parameters'] = {
      environment_name: environment,
      repository_id: await getRepoId(owner, repo),
      name,
      value,
    };
    const response = await octokit.rest.actions.createEnvironmentVariable(parameters);

    if (response.status === 201 || response.status === 204) {
      return name;
    }

    throw new Error(`Error setting environment variable value: ${name}: status code ${response.status} - ${environment}`);
  }
}

export async function deleteEnvironmentSecret(
  secretName: string,
  owner: string,
  repo: string,
  environment: string,
): Promise<string> {
  const parameters: RestEndpointMethodTypes['actions']['deleteEnvironmentSecret']['parameters'] = {
    environment_name: environment,
    repository_id: await getRepoId(owner, repo),
    secret_name: secretName,
  };
  const response = await octokit.rest.actions.deleteEnvironmentSecret(parameters);

  if (response.status === 204) {
    return secretName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error deleting environment secret: ${secretName}: status code ${response.status} - ${environment}`);
}

export async function deleteEnvironmentVariable(
  variableName: string,
  owner: string,
  repo: string,
  environment: string,
): Promise<string> {
  const parameters: RestEndpointMethodTypes['actions']['deleteEnvironmentVariable']['parameters'] = {
    environment_name: environment,
    repository_id: await getRepoId(owner, repo),
    name: variableName,
  };
  const response = await octokit.rest.actions.deleteEnvironmentVariable(parameters);

  if (response.status === 204) {
    return variableName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error deleting environment variable: ${variableName}: status code ${response.status} - ${environment}`);
}
