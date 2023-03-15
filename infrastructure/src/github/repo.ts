import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import encrypt from './encrypt';

const username = process.env.USERNAME;
const personalAccessToken = process.env.PERSONAL_ACCESS_TOKEN;

const octokit = new Octokit({
  auth: personalAccessToken,
  userAgent: username,
});

let repoPublicKey: any;
const environmentPublicKeys: Record<string, any> = {};

export async function getRepo(owner: string, repo: string): Promise<any> {
  const info = <RestEndpointMethodTypes['repos']['get']['parameters']>{
    owner,
    repo,
  };
  console.log(`Getting repo information: ${JSON.stringify(info)}`);
  const response = await octokit.repos.get(info);

  if (response.status === 200) {
    return response.data;
  }
  console.log(response);
  throw new Error('Error getting repo information');
}

export async function getRepoId(owner: string, repo: string) {
  return (await octokit.repos.get({ owner, repo })).data.id;
}

export async function getRepoPublicKey(owner: string, repo: string) {
  if (repoPublicKey) return repoPublicKey;

  const response = await octokit.actions.getRepoPublicKey({
    owner,
    repo,
  });

  if (response.status !== 200) {
    console.log(response);
    throw new Error('Error getting repo public key');
  }

  // Cache and return the result
  repoPublicKey = response.data;
  return repoPublicKey;
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

export async function listRepoSecrets(owner: string, repo: string): Promise<string[]> {
  const response = await octokit.actions.listRepoSecrets({
    owner,
    repo,
    per_page: 100,
  });

  if (response.status !== 200) {
    console.log(response);
    throw new Error('Error listing repo secrets');
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

export async function listRepoVariables(owner: string, repo: string): Promise<string[]> {
  const response = await octokit.actions.listRepoVariables({
    owner,
    repo,
    per_page: 100,
  });

  if (response.status !== 200) {
    console.log(response);
    throw new Error('Error listing repo variables');
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

export async function setRepoSecret(
  secretName: string,
  secretValue: string,
  owner: string,
  repo: string,
): Promise<string> {
  if (!secretValue) throw new Error(`No value for secret ${secretName}`);
  const publicKey = await getRepoPublicKey(owner, repo);
  const encryptedValue = await encrypt(secretValue, publicKey.key);
  const response = await octokit.actions.createOrUpdateRepoSecret({
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: publicKey.key_id,
  });

  if (response.status === 201 || response.status === 204) {
    return secretName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error setting secret value: ${secretName}: status code ${response.status}`);
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

export async function setRepoVariable(
  name: string,
  value: string,
  owner: string,
  repo: string,
): Promise<string> {
  if (!value) throw new Error(`No value for secret ${name}`);
  const response = await octokit.rest.actions.createRepoVariable({
    owner,
    repo,
    name,
    value,
  });

  if (response.status === 201 || response.status === 204) {
    return name;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error setting environment variable value: ${name}: status code ${response.status}`);
}

export async function setEnvironmentVariable(
  name: string,
  value: string,
  owner: string,
  repo: string,
  environment: string,
): Promise<string> {
  if (!value) throw new Error(`No value for secret ${name}`);
  try {
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

export async function deleteRepoSecret(
  secretName: string,
  owner: string,
  repo: string,
): Promise<string> {
  const response = await octokit.rest.actions.deleteRepoSecret({
    owner,
    repo,
    secret_name: secretName,
  });

  if (response.status === 204) {
    return secretName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error deleting secret value: ${secretName}: status code ${response.status}`);
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

export async function deleteRepoVariable(
  variableName: string,
  owner: string,
  repo: string,
): Promise<string> {
  const response = await octokit.rest.actions.deleteRepoVariable({
    owner,
    repo,
    name: variableName,
  });

  if (response.status === 204) {
    return variableName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error deleting variable value: ${variableName}: status code ${response.status}`);
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
