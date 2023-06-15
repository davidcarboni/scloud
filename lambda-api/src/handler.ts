/* eslint-disable import/prefer-default-export */
// https://aws.amazon.com/blogs/mobile/understanding-amazon-cognito-user-pool-oauth-2-0-grants/
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
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
    if (value) result[name.toLowerCase()] = value;
  });
  return result;
}

/**
 * Parses the body (if present) to a JSON string. Returns at mimimum an empty object.
 * @param body APIGatewayProxyEvent.body
 */
export function parseBody(body: string | null): { [name: string]: string; } {
  if (!body) return {};
  let result = {};
  try {
    result = JSON.parse(body);
  } catch (e) {
    console.error(`Error parsing request body: ${e}`);
  }
  return result;
}

/**
 * Parses the cookie, if any, returning at minimum an empty object.
 * @param headers APIGatewayProxyEvent.headers
 */
export function parseCookie(headers: { [name: string]: string | undefined; }): { [name: string]: string; } {
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
    body: parseBody(event.body),
    cookies: parseCookie(event.headers),
  };
}

/**
 * Generic routing handler
 */
export async function apiHandler(event: APIGatewayProxyEvent, context: Context, routes: Routes = {
  '/api/ping': { GET: async (request: Request) => ({ statusCode: 200, body: request }) },
}): Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH}`);

  const request = parseRequest(event);

  const route = routes[request.path];
  if (!route) return { statusCode: 404, body: JSON.stringify('Not found') };

  const handlerFunction = route[request.method as keyof Route];
  if (!handlerFunction) return { statusCode: 405, body: JSON.stringify('Method not allowed') };

  try {
    const response = await handlerFunction(request);

    // Response
    const result: APIGatewayProxyResult = {
      statusCode: response.statusCode,
      body: JSON.stringify(response.body),
      headers: response.headers,
    };

    // Cookies (if set)
    const cookieHeaders = buildCookie(response.cookies);
    if (cookieHeaders) {
      result.multiValueHeaders = {
        Cookie: cookieHeaders,
      };
    }

    return result;
  } catch (e) {
    console.error(`${(e as Error).message}\n${(e as Error).stack}`);
    return {
      statusCode: 500, body: JSON.stringify('Internal server error'),
    };
  }
}
