import sodium from 'libsodium-wrappers';

/**
 * Based on: https://docs.github.com/en/rest/actions/secrets?apiVersion=2022-11-28#create-or-update-a-repository-secret
 * @param secretValue The secret value to be encrypted
 * @param key The key to use for encryption (eg repository public key)
 * @returns The encrypted value (a base-64 string)
 */
export default async function encrypt(secretValue: string, key: string): Promise<string> {
  // Convert Secret & Base64 key to Uint8Array.
  const secretBytes = sodium.from_string(secretValue);
  const keyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);

  // Encrypt using LibSodium.
  await sodium.ready;
  const encryptedBytes = sodium.crypto_box_seal(secretBytes, keyBytes);

  // Convert encrypted Uint8Array to Base64
  const encryptedB64 = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

  return encryptedB64;
}
