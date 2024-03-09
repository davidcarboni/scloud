const baseUrl = 'https://example.com';
// const baseUrl = 'http://localhost:3000'; // For local testing

/**
 * Builds an authorization header if a token is provided
 */
function authorization(token?: string): Record<string, string> {
  return token ? {
    Authorization: `Bearer ${token}`,
  } : {};
}

/**
 * Builds a URL which includes query parameters if provided
 */
function url(path: string, queryParameters?: Record<string, any>) {
  return `${baseUrl}${path}?${new URLSearchParams(queryParameters)}`;
}

export function get(path: string, queryParameters?: Record<string, any>, token?: string): Promise<Response> {
  return fetch(url(path, queryParameters), { headers: authorization(token) });
}

export function post(path: string, body: Record<string, any>, token?: string): Promise<Response> {
  return fetch(url(path), { method: 'POST', headers: authorization(token), body: JSON.stringify(body) });
}

export function del(path: string, queryParameters?: Record<string, any>, token?: string): Promise<Response> {
  return fetch(url(path, queryParameters), { method: 'DELETE', headers: authorization(token) });
}

export function put(path: string, body: Record<string, any>, token?: string): Promise<Response> {
  return fetch(url(path), { method: 'PUT', body: JSON.stringify(body), headers: authorization(token) });
}
