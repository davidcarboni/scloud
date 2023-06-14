/* eslint-disable import/prefer-default-export */
export function parseJson(s: string | undefined): any | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch (err) {
    return undefined;
  }
}
