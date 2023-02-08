import { seal } from 'tweetsodium';
import libsodium from 'libsodium-wrappers';

export function encrypt(secretValue: string, key: string): string {
  // Convert the message and key to Uint8Array's (Buffer implements that interface)
  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(key, 'base64');

  // Encrypt using LibSodium.
  const encryptedBytes = seal(messageBytes, keyBytes);
  const encryptedB64 = Buffer.from(encryptedBytes).toString('base64');

  return encryptedB64;
}

export async function encryptSodium(secretValue: string, key: string): Promise<string> {
  // Convert the message and key to Uint8Array's (Buffer implements that interface)
  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(key, 'base64');

  // Encrypt using LibSodium.
  await libsodium.ready;
  const encryptedBytes = libsodium.crypto_box_seal(messageBytes, keyBytes);
  const encryptedB64 = Buffer.from(encryptedBytes).toString('base64');

  return encryptedB64;
}
