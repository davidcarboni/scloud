import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import encrypt from './encrypt';

const username = process.env.USERNAME;
const personalAccessToken = process.env.PERSONAL_ACCESS_TOKEN;

const octokit = new Octokit({
  auth: personalAccessToken,
  userAgent: username,
});

let repoPublicKey: any;

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

/**
 * Updates (or creates) a variable at the repository level.
 * @param name name of the variable
 * @param value value for the variable
 * @param owner Owner (or organisation) for the repository
 * @param repo Repository name
 * @returns
 */
export async function setRepoVariable(
  name: string,
  value: string,
  owner: string,
  repo: string,
): Promise<string> {
  if (!value) throw new Error(`No value for secret ${name}`);
  try {
    // Most likely we're updating an existing variable:
    const response = await octokit.rest.actions.updateRepoVariable({
      owner,
      repo,
      name,
      value,
    });

    if (response.status === 204) {
      return name;
    }

    throw new Error(`Error setting repo variable value: ${name}: status code ${response.status}`);
  } catch (e) {
    // If not, we might be creating a new variable:
    const response = await octokit.rest.actions.createRepoVariable({
      owner,
      repo,
      name,
      value,
    });

    if (response.status === 201 || response.status === 204) {
      return name;
    }

    throw new Error(`Error setting repo variable value: ${name}: status code ${response.status}`);
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
