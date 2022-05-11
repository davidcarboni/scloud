import { seal } from 'tweetsodium';

export default function encrypt(secretValue: string, key: string): string {
  // Convert the message and key to Uint8Array's (Buffer implements that interface)
  const messageBytes = Buffer.from(secretValue);
  const keyBytes = Buffer.from(key, 'base64');

  // Encrypt using LibSodium.
  const encryptedBytes = seal(messageBytes, keyBytes);
  const encryptedB64 = Buffer.from(encryptedBytes).toString('base64');

  return encryptedB64;
}
