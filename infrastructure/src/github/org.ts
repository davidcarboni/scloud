import { Octokit } from '@octokit/rest';
import * as util from 'util';
import encrypt from './encrypt';

/**
 * Gets a public ket for an organisation.
 * @param octokit Octokit instance
 * @param org The organisation to query
 * @returns The public key for the organisation
 */
export async function getOrgPublicKey(octokit: Octokit, org: string): Promise<any> {
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
    const response = await octokit.actions.createOrUpdateOrgSecret({
      org,
      secret_name: secretName,
      encryptedValue,
      key_id: orgPublicKey.key_id,
      visibility: 'selected',
    });
    if (repoIDs) {
      octokit.rest.actions.setSelectedReposForOrgSecret({
        org,
        secret_name: secretName,
        selected_repository_ids: repoIDs,
      });
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
    const response = await octokit.repos.listForOrg({
      org,
    });

    if (response.status === 200) {
      response.data.forEach((repo) => repos.push(repo.name));
    }
  } catch (err) {
    console.log(` - Error listing repositories for ${org}.`);
    console.log(util.inspect(err));
  }
  return repos;
}
