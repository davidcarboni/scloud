import * as util from 'util';
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
type PublicKey = GetResponseDataTypeFromEndpointMethod<
  typeof octokit.actions.getOrgPublicKey
>;

/**
 * Gets a public ket for an organisation.
 * @param octokit Octokit instance
 * @param org The organisation to query
 * @returns The public key for the organisation
 */
export async function getOrgPublicKey(octokit: Octokit, org: string): Promise<PublicKey> {
  console.log('Getting org public key...');

  const response = await octokit.actions.getOrgPublicKey({ org });

  if (response.status === 200) {
    return response.data;
  }
  console.log(response);
  throw new Error('Error getting org public key');
}

/**
 * Sets a github secret on an organisation
 * @param octokit Octokit instance
 * @param org The organisation to set the secret on
 * @param secretName The secret name
 * @param secretValue The value to set
 * @param repoIDs (potional) The IDs of the repositoried to give access to the secret
 * @returns An empty string if succedssful, otherwise the name of the failed secret
 */
export async function setOrgSecret(
  octokit: Octokit,
  org: string,
  secretName: string,
  secretValue: string,
  repoIDs?: number[],
): Promise<string> {
  const orgPublicKey = await getOrgPublicKey(octokit, org);
  const encryptedValue = encrypt(secretValue, orgPublicKey.key);
  try {
    const parameters: RestEndpointMethodTypes['actions']['createOrUpdateOrgSecret']['parameters'] = {
      org,
      secret_name: secretName,
      encryptedValue,
      key_id: orgPublicKey.key_id,
      visibility: 'selected',
    };
    const response = await octokit.actions.createOrUpdateOrgSecret(parameters);
    if (repoIDs) {
      const parameters: RestEndpointMethodTypes['actions']['setSelectedReposForOrgSecret']['parameters'] = {
        org,
        secret_name: secretName,
        selected_repository_ids: repoIDs,
      };
      octokit.rest.actions.setSelectedReposForOrgSecret(parameters);
    }

    if (response.status === 201 || response.status === 204) {
      console.log(`${secretName} * org`);
      return '';
    }
  } catch (err) {
    console.log(` - Error setting ${secretName} on organisation ${org}.`);
    console.log(util.inspect(err));
  }
  return secretName;
}

/**
 * Sets a github secret on an organisation
 * @param octokit Octokit instance
 * @param org The organisation to set the secret on
 * @param secretName The secret name
 * @param secretValue The value to set
 * @param repoIDs The IDs of the repositoried to give access to the secret
 * @returns An empty string if succedssful, otherwise the name of the failed secret
 */
export async function listRepos(
  octokit: Octokit,
  org: string,
): Promise<string[]> {
  const repos: string[] = [];
  try {
    const parameters: RestEndpointMethodTypes['repos']['listForOrg']['parameters'] = {
      org,
    };
    const response = await octokit.repos.listForOrg(parameters);

    if (response.status === 200) {
      response.data.forEach((repo) => repos.push(repo.name));
    }
  } catch (err) {
    console.log(` - Error listing repositories for ${org}.`);
    console.log(util.inspect(err));
  }
  return repos;
}
