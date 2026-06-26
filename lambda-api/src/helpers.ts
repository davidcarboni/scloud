import { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from 'aws-lambda';
import { parseCookie as parseCookieHeader, stringifySetCookie } from 'cookie';
import { ApiGatewayProxyEventAny, isApiGatewayEventV2 } from './event';
import { Request, Response, Route, Routes } from './types';

export { ApiGatewayProxyEventAny, ApiGatewayProxyResultFor, isApiGatewayEventV2 } from './event';

/**
 * Ensures the path always has a leading slash and never a trailing slash
 * @param path APIGatewayProxyEvent.path
 */
export function standardPath(path: string): string {
  // Get path segments, filtering out any blanks
  const segments = path.split('/').filter((segment) => segment);
  // Return path
  return `/${segments.join('/')}`;
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
 * Ensures all headers have a value.
 * @param headers APIGatewayProxyEvent.headers
 */
export function standardHeaders(headers: { [name: string]: string | undefined; }): { [name: string]: string; } {
  const result: { [name: string]: string; } = {};
  for (const [name, value] of Object.entries(headers || {})) {
    result[name] = value ?? '';
  }
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
export function parseCookie(headers: { [name: string]: string | undefined; }): { [name: string]: string; } {
  const header = getHeader('Cookie', headers);
  const values = header ? parseCookieHeader(header) : {};

  // Ensure we don't return any undefined values
  const result: { [name: string]: string; } = {};
  for (const [name, value] of Object.entries(values)) {
    if (value) result[name] = value;
  }
  return result;
}

export function buildCookie(
  response: Response,
  maxAge: number | undefined = 60 * 60 * 24 * 365,
  expires: Date | undefined = undefined,
  secure: boolean = true,
  httpOnly: boolean = true,
  sameSite: 'strict' | 'lax' | 'none' = 'lax',
): string[] | undefined {
  if (!response.cookies) return undefined;

  const cookies: { [key: string]: string; } = {};
  for (const [key, value] of Object.entries(response.cookies)) {
    cookies[key] = value;
  }

  const header: string[] = [];

  Object.keys(cookies).forEach((key) => {
    const value = cookies[key];
    if (value === '') {
      // If explicitly unset, expire the cookie value
      header.push(stringifySetCookie({
        name: key, value: '', expires: new Date(), secure, httpOnly, sameSite,
      }));
    } else if (value) {
      // Otherwise, set it only if a value was given
      header.push(stringifySetCookie({
        name: key, value, maxAge, expires, secure, httpOnly, sameSite,
      }));
    }
  });

  return header;
}

/**
 * Case-insensitive header lookup
 */
export function getHeader(name: string, headers: { [key: string]: string | undefined; } | undefined): string | undefined {
  if (!headers) return undefined;

  // Exact match
  if (headers[name]) return headers[name];

  // Case-insensitive match
  const lowercased: { [key: string]: string | undefined; } = {};
  for (const [key, value] of Object.entries(headers)) {
    lowercased[key.toLowerCase()] = value;
  }
  return lowercased[name.toLowerCase()];
}

/**
 * Case-insensitive header setting
 */
export function setHeader(name: string, value: string, headers: { [key: string]: string | undefined; } | undefined): void {
  if (!headers) return;
  let set = false;
  for (const key of Object.keys(headers)) {
    if (name.toLowerCase() === key.toLowerCase()) {
      headers[key] = value;
      set = true;
    }
  }
  if (!set) headers[name] = value;
}

function parseCookiesArray(cookies: string[] | undefined): Record<string, string> {
  if (!cookies) return {};
  const result: Record<string, string> = {};
  cookies.forEach((entry) => {
    const separator = entry.indexOf('=');
    if (separator === -1) return;
    const name = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    if (name) result[name] = value;
  });
  return result;
}

function standardPathParameters(params: Record<string, string | undefined> | undefined): Record<string, string> {
  if (!params) return {};
  const result: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value) result[key] = value;
  });
  return result;
}

function parseRequestV1(event: APIGatewayProxyEvent): Request {
  return {
    method: event.httpMethod,
    path: standardPath(event.path),
    query: standardQueryParameters(event.queryStringParameters),
    headers: standardHeaders(event.headers),
    body: parseBody(event.body, event.isBase64Encoded, getHeader('Content-Type', event.headers)),
    cookies: parseCookie(event.headers),
    pathParameters: {},
    context: { event },
  };
}

function parseRequestV2(event: APIGatewayProxyEventV2): Request {
  const headers = standardHeaders(event.headers);
  const cookies = {
    ...parseCookie(event.headers),
    ...parseCookiesArray(event.cookies),
  };
  const query = event.queryStringParameters
    ?? (event.rawQueryString ? Object.fromEntries(new URLSearchParams(event.rawQueryString)) : null);

  return {
    method: event.requestContext.http.method,
    path: standardPath(event.rawPath),
    query: standardQueryParameters(query),
    headers,
    body: parseBody(event.body ?? null, event.isBase64Encoded, getHeader('content-type', headers)),
    cookies,
    pathParameters: standardPathParameters(event.pathParameters),
    context: { event },
  };
}

/**
 * Parses a REST API (v1) or HTTP API / Function URL (v2) proxy event into a Request.
 */
export function parseRequest(event: ApiGatewayProxyEventAny): Request {
  if (isApiGatewayEventV2(event)) return parseRequestV2(event);
  return parseRequestV1(event);
}

export function matchRoute(routes: Routes, path: string): { methods: Route | undefined, params?: { [name: string]: string; }; } {
  // Direct match
  if (routes[path]) return { methods: routes[path], params: {} };

  // List paths to check
  const paths = Object.keys(routes);

  // Case-insensitive match
  for (const candidate of paths) {
    if (candidate.toLowerCase() === path.toLowerCase()) return { methods: routes[candidate], params: {} };
  }

  // Path-parameter matching
  const pathSegments = path.split('/');

  for (const candidate of paths) {
    const candidateSegments = candidate.split('/');

    // First check: length match
    if (pathSegments.length !== candidateSegments.length) continue;

    const params: { [name: string]: string; } = {};
    for (let s = 0; s < pathSegments.length; s++) {
      const pathSegment = pathSegments[s];
      const candidateSegment = candidateSegments[s];
      if (candidateSegment.startsWith('{') && candidateSegment.endsWith('}')) {
        // Path parameter
        const name = candidateSegment.slice(1, -1);
        params[name] = pathSegment;
      } else if (pathSegment.toLowerCase() !== candidateSegment.toLowerCase()) {
        break;
      }

      if (s === pathSegments.length - 1) {
        // Matched all segments
        return { methods: routes[candidate], params };
      }
    }
  }

  return { methods: undefined };
}
