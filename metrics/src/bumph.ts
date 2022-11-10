export function env(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.warn(`Environment variable not set: ${key}`);
  }
  return value || '';
}

/**
 * Generates a unique-enough identifier using random characters, plus the current timestamp.
 * It's as random and unique as we need because the chances of generating the same random
 * characters within the same millisecond is small enough to work for now.
 * @returns A value made up of random characters plus a timestamp
 */
export function id() {
  return `${(Math.random() + 1).toString(36).substring(2)}-${new Date().getTime()}`;
}
