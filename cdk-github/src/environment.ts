import { Octokit } from '@octokit/rest';
import encrypt from './encrypt';

const username = process.env.USERNAME;
const personalAccessToken = process.env.PERSONAL_ACCESS_TOKEN;

const octokit = new Octokit({
  auth: personalAccessToken,
  userAgent: username,
});

const environmentPublicKeys: Record<string, any> = {};

async function getRepoId(owner: string, repo: string) {
  return (await octokit.repos.get({ owner, repo })).data.id;
}

export async function getEnvironmentPublicKey(owner: string, repo: string, environment: string) {
  if (environmentPublicKeys[environment]) return environmentPublicKeys[environment];

  const repoId = await getRepoId(owner, repo);
  const response = await octokit.actions.getEnvironmentPublicKey({
    repository_id: repoId,
    environment_name: environment,
  });

  if (response.status !== 200) {
    console.log(response);
    throw new Error('Error getting environment public key');
  }

  // Cache and return the result
  environmentPublicKeys[environment] = response.data;
  return environmentPublicKeys[environment];
}

export async function listEnvironmentSecrets(owner: string, repo: string, environment: string): Promise<string[]> {
  const response = await octokit.actions.listEnvironmentSecrets({
    environment_name: environment,
    repository_id: await getRepoId(owner, repo),
    per_page: 100,
  });

  if (response.status !== 200) {
    console.log(response);
    throw new Error(`Error listing environment ${environment} secrets`);
  }

  const { secrets } = response.data;
  const totalCount = response.data.total_count;

  // Check we've got all the secrets
  if (totalCount > 100) {
    throw new Error('Too many secrets, need to paginate.');
  }

  // Collate secret names
  const names: string[] = [];
  secrets.forEach((secret) => {
    names.push(secret.name);
  });

  return names;
}

export async function listEnvironmentVariables(owner: string, repo: string, environment: string): Promise<string[]> {
  const response = await octokit.actions.listEnvironmentVariables({
    environment_name: environment,
    repository_id: await getRepoId(owner, repo),
    per_page: 100,
  });

  if (response.status !== 200) {
    console.log(response);
    throw new Error(`Error listing environment ${environment} variables`);
  }

  const { variables } = response.data;
  const totalCount = response.data.total_count;

  // Check we've got all the secrets
  if (totalCount > 100) {
    throw new Error('Too many variables, need to paginate.');
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
  if (!secretValue) throw new Error(`No value for secret ${secretName}`);
  const environmentPublicKey = await getEnvironmentPublicKey(owner, repo, environment);
  const encryptedValue = await encrypt(secretValue, environmentPublicKey.key);
  const repoId = await getRepoId(owner, repo);
  const response = await octokit.actions.createOrUpdateEnvironmentSecret({
    environment_name: environment,
    repository_id: repoId,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: environmentPublicKey.key_id,
  });

  if (response.status === 201 || response.status === 204) {
    return secretName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error setting environment ${environment} secret value: ${secretName}: status code ${response.status}`);
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
  if (!value) throw new Error(`No value for secret ${name}`);
  try {
    // Most likely we're updating an existing variable:
    const response = await octokit.rest.actions.updateEnvironmentVariable({
      environment_name: environment,
      repository_id: await getRepoId(owner, repo),
      name,
      value,
    });

    if (response.status === 204) {
      return name;
    }

    throw new Error(`Error setting environment ${environment} variable value: ${name}: status code ${response.status}`);
  } catch (e) {
    // If not, we might be creating a new variable:
    const response = await octokit.rest.actions.createEnvironmentVariable({
      environment_name: environment,
      repository_id: await getRepoId(owner, repo),
      name,
      value,
    });

    if (response.status === 201 || response.status === 204) {
      return name;
    }

    throw new Error(`Error setting environment ${environment} variable value: ${name}: status code ${response.status}`);
  }
}

export async function deleteEnvironmentSecret(
  secretName: string,
  owner: string,
  repo: string,
  environment: string,
): Promise<string> {
  const response = await octokit.rest.actions.deleteEnvironmentSecret({
    environment_name: environment,
    repository_id: await getRepoId(owner, repo),
    secret_name: secretName,
  });

  if (response.status === 204) {
    return secretName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error deleting environment ${environment} secret value: ${secretName}: status code ${response.status}`);
}

export async function deleteEnvironmentVariable(
  variableName: string,
  owner: string,
  repo: string,
  environment: string,
): Promise<string> {
  const response = await octokit.rest.actions.deleteEnvironmentVariable({
    environment_name: environment,
    repository_id: await getRepoId(owner, repo),
    name: variableName,
  });

  if (response.status === 204) {
    return variableName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error deleting environment ${environment} variable value: ${variableName}: status code ${response.status}`);
}
