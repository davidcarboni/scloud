import { APIGatewayProxyEvent } from 'aws-lambda';
import * as cookie from 'cookie';
import { Request, Route, Routes } from './types';

/**
 * Ensures the path is lowercased, always has a leading slash and never a trailing slash
 * @param path APIGatewayProxyEvent.path
 */
export function standardPath(path: string): string {
  // Get path segments, filtering out any blanks
  const segments = path.split('/').filter((segment) => segment);
  // Return path
  return `/${segments.join('/').toLowerCase()}`;
}

/**
 * Ensures a non-null object containing only query-string parameters that have a value.
 * @param query APIGatewayProxyEvent.query
 */
export function standardQueryParameters(query: { [name: string]: string | undefined; } | null): { [name: string]: string; } {
  if (!query) return {};
  const result: { [name: string]: string; } = {};
  Object.keys(query).forEach((parameter) => {
    const value = query[parameter];
    if (value) result[parameter] = value;
  });
  return result;
}

/**
 * Ensures all header names are lowercased for ease of access.
 * @param headers APIGatewayProxyEvent.headers
 */
export function standardHeaders(headers: { [name: string]: string | undefined; }): { [name: string]: string; } {
  const result: { [name: string]: string; } = {};
  Object.keys(headers).forEach((name) => {
    const value = headers[name];
    if (value) {
      // Provide both original-case and lowercased (standardised) header names for ease of access:
      result[name] = value;
      result[name.toLowerCase()] = value;
    }
  });
  return result;
}

/**
 * Parses the body (if present) from application/x-www-form-urlencoded or JSON string.
 * If the body fails to parse as JSOn, the raw body is returned.
 * @param body APIGatewayProxyEvent.body
 */
export function parseBody(body: string | null, isBase64Encoded: boolean, contentType: string = 'application/json'): Record<string, unknown> | string {
  if (!body) return {};

  const content = isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;

  try {
    if ((contentType || '').toLowerCase() === 'application/x-www-form-urlencoded') {
      return Object.fromEntries(new URLSearchParams(content));
    } else {
      // Default to parsing as JSON:
      return JSON.parse(content);
    }
  } catch (e) {
    console.error(`Error parsing request body: ${e}`);
  }

  // Fallback to returning the raw body
  return content;
}

/**
 * Parses the cookie, if any, returning at minimum an empty object.
 * @param headers APIGatewayProxyEvent.headers
 */
export function parseCookie(headers: { [name: string]: string | undefined; }): { [name: string]: string | undefined; } {
  const header = headers.cookie || headers.Cookie || '';
  return cookie.parse(header);
}

export function buildCookie(values: { [key: string]: string; } | undefined): string[] | undefined {
  if (!values) return undefined;

  const header: string[] = [];
  const oneYear = 60 * 60 * 24 * 365;

  Object.keys(values).forEach((key) => {
    const value = values[key];
    if (value === '') {
      // If explicitly unset, expire the cookie value
      header.push(cookie.serialize(key, '', {
        expires: new Date(), secure: true, httpOnly: true, sameSite: 'strict',
      }));
    } else if (value) {
      // Otherwise, set it only if a value was given
      header.push(cookie.serialize(key, value, {
        maxAge: oneYear, secure: true, httpOnly: true, sameSite: 'strict',
      }));
    }
  });

  return header;
}

export function parseRequest(event: APIGatewayProxyEvent): Request {
  return {
    method: event.httpMethod,
    path: standardPath(event.path),
    query: standardQueryParameters(event.queryStringParameters),
    headers: standardHeaders(event.headers),
    body: parseBody(event.body, event.isBase64Encoded, event.headers['content-type']),
    cookies: parseCookie(event.headers),
    pathParameters: {}, // These need to be parsed as part of route matching
    context: {}, // You can add any custom values you need to the request via this context
  };
}

export function matchRoute(routes: Routes, path: string): { route: Route | undefined, params: { [name: string]: string; }; } {
  // Simple match
  if (routes[path]) return { route: routes[path], params: {} };

  // List paths to check
  const paths = Object.keys(routes);

  // Case-insensitive match
  for (let p = 0; p < paths.length; p++) {
    const candidate = paths[p];
    if (candidate.toLowerCase() === path.toLowerCase()) return { route: routes[candidate], params: {} };
  }

  // Path-parameter matching
  const pathSegments = path.split('/');

  for (let p = 0; p < paths.length; p++) {
    const candidate = paths[p];
    const candidateSegments = candidate.split('/');

    // First check: length match
    if (pathSegments.length !== candidateSegments.length) continue;

    for (let s = 0; s < pathSegments.length; s++) {
      const params: { [name: string]: string; } = {};
      const pathSegment = pathSegments[s];
      const candidateSegment = candidateSegments[s];
      if (candidateSegment.startsWith('{') && candidateSegment.endsWith('}')) {
        // Path parameter
        const name = candidateSegment.slice(1, -1);
        params[name] = pathSegment;
      } else if (pathSegment !== candidateSegment) {
        break;
      }

      if (s === pathSegments.length - 1) {
        // Matched all segments
        return { route: routes[candidate], params };
      }
    }
  }

  return { route: undefined, params: {} };
}
