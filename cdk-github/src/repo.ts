import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import {
  GetResponseDataTypeFromEndpointMethod,
} from "@octokit/types";
import encrypt from './encrypt';

// See: https://github.com/octokit/types.ts
type Repo = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.repos.get
>;
type PublicKey = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.actions.getRepoPublicKey
>;

const username = process.env.USERNAME;
const personalAccessToken = process.env.PERSONAL_ACCESS_TOKEN;

const octokit = new Octokit({
  auth: personalAccessToken,
  userAgent: username,
});

let repoPublicKey: PublicKey;

export async function getRepo(owner: string, repo: string): Promise<Repo> {
  const parameters: RestEndpointMethodTypes['repos']['get']['parameters'] = {
    owner,
    repo,
  };
  console.log(`Getting repo information: ${JSON.stringify(parameters)}`);
  const response = await octokit.repos.get(parameters);

  if (response.status === 200) {
    return response.data;
  }
  console.log(response);
  throw new Error('Error getting repo information');
}

export async function getRepoId(owner: string, repo: string) {
  const parameters: RestEndpointMethodTypes['repos']['get']['parameters'] = {
    owner,
    repo,
  };
  return (await octokit.repos.get(parameters)).data.id;
}

export async function getRepoPublicKey(owner: string, repo: string): Promise<PublicKey> {
  if (repoPublicKey) return repoPublicKey;

  const parameters: RestEndpointMethodTypes['actions']['getRepoPublicKey']['parameters'] = {
    owner,
    repo,
  };
  const response = await octokit.actions.getRepoPublicKey(parameters);

  if (response.status !== 200) {
    console.log(response);
    throw new Error('Error getting repo public key');
  }

  // Cache and return the result
  repoPublicKey = response.data;
  return repoPublicKey;
}

export async function listRepoSecrets(owner: string, repo: string): Promise<string[]> {
  const parameters: RestEndpointMethodTypes['actions']['listRepoSecrets']['parameters'] = {
    owner,
    repo,
    per_page: 100,
  };
  const response = await octokit.actions.listRepoSecrets(parameters);

  if (response.status !== 200) {
    console.log(response);
    throw new Error('Error listing repo secrets');
  }

  const { secrets } = response.data;
  const totalCount = response.data.total_count;

  // Check we've got all the secrets
  if (totalCount > 100) {
    throw new Error('Too many repo secrets, TODO: need to paginate.');
  }

  // Collate secret names
  const names: string[] = [];
  secrets.forEach((secret) => {
    names.push(secret.name);
  });

  return names;
}

export async function listRepoVariables(owner: string, repo: string): Promise<string[]> {
  const parameters: RestEndpointMethodTypes['actions']['listRepoVariables']['parameters'] = {
    owner,
    repo,
    per_page: 100,
  };
  const response = await octokit.actions.listRepoVariables(parameters);

  if (response.status !== 200) {
    console.log(response);
    throw new Error('Error listing repo variables');
  }

  const { variables } = response.data;
  const totalCount = response.data.total_count;

  // Check we've got all the secrets
  if (totalCount > 100) {
    throw new Error('Too many repo variables, TODO: need to paginate.');
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
  if (!secretValue) throw new Error(`No value for repo secret ${secretName} (${owner}/${repo})`);
  const publicKey = await getRepoPublicKey(owner, repo);
  const encryptedValue = await encrypt(secretValue, publicKey.key);
  const parameters: RestEndpointMethodTypes['actions']['createOrUpdateRepoSecret']['parameters'] = {
    owner,
    repo,
    secret_name: secretName,
    encrypted_value: encryptedValue,
    key_id: publicKey.key_id,
  };
  const response = await octokit.actions.createOrUpdateRepoSecret(parameters);

  if (response.status === 201 || response.status === 204) {
    return secretName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error setting repo secret value: ${secretName}: status code ${response.status}`);
}

export async function setRepoVariable(
  name: string,
  value: string,
  owner: string,
  repo: string,
): Promise<string> {
  if (!value) throw new Error(`No value for repo variable ${name} (${owner}/${repo}))`);
  try {
    // Most likely we're updating an existing variable:
    const parameters: RestEndpointMethodTypes['actions']['updateRepoVariable']['parameters'] = {
      owner,
      repo,
      name,
      value,
    };
    const response = await octokit.rest.actions.updateRepoVariable(parameters);

    if (response.status === 204) {
      return name;
    }

    throw new Error(`Error setting repo variable value: ${name}: status code ${response.status}`);
  } catch (e) {
    // If not, we might be creating a new variable:
    const parameters: RestEndpointMethodTypes['actions']['createRepoVariable']['parameters'] = {
      owner,
      repo,
      name,
      value,
    };
    const response = await octokit.rest.actions.createRepoVariable(parameters);

    if (response.status === 201 || response.status === 204) {
      return name;
    }
    // Looks like that didn't work.
    console.log(response);
    throw new Error(`Error setting repo variable value: ${name}: status code ${response.status}`);
  }
}

export async function deleteRepoSecret(
  secretName: string,
  owner: string,
  repo: string,
): Promise<string> {
  const parameters: RestEndpointMethodTypes['actions']['deleteRepoSecret']['parameters'] = {
    owner,
    repo,
    secret_name: secretName,
  };
  const response = await octokit.rest.actions.deleteRepoSecret(parameters);

  if (response.status === 204) {
    return secretName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error deleting repo secret value: ${secretName}: status code ${response.status}`);
}

export async function deleteRepoVariable(
  variableName: string,
  owner: string,
  repo: string,
): Promise<string> {
  const parameters: RestEndpointMethodTypes['actions']['deleteRepoVariable']['parameters'] = {
    owner,
    repo,
    name: variableName,
  };
  const response = await octokit.rest.actions.deleteRepoVariable(parameters);

  if (response.status === 204) {
    return variableName;
  }
  // Looks like that didn't work.
  console.log(response);
  throw new Error(`Error deleting repo variable value: ${variableName}: status code ${response.status}`);
}
