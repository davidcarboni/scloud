export default function env(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.warn(`Environment variable not set: ${key}`);
  }
  return value || '';
}
