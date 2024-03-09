/**
 * @returns The specified environment variable if set, otherwise throws an exception. Ensures vissing variables are detected in testing.
 */
export function env(name: string): string {
  const result = process.env[name];
  if (!result) throw new Error(`Missing environment variable: ${name}`);
  return result;
}

/**
 * @returns A clean s3 key
 */
export function key(user: string, path?: string): string {
  const cleanPath = path ? path.split('/').filter((segment) => segment) : [];
  return [user].concat(cleanPath).join('/');
}
