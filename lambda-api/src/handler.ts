import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import {
  Request, Response, Handler, Route, Routes,
  ApiError,
} from './types';
import { buildCookie, getHeader, matchRoute, parseRequest, setHeader } from './helpers';
import z from 'zod/v4';

function apiErrorResponse(e?: unknown): Response {
  // Intentional API error response
  if (e instanceof ApiError) {
    return {
      statusCode: e.statusCode,
      body: e.body,
    };
  }

  // Unhandled error
  if (e) console.error(e instanceof Error ? e.stack : e);
  return {
    statusCode: 500,
    body: 'Internal server error',
  };
}

/**
 * API route handler
 */
export async function apiHandler(
  event: APIGatewayProxyEvent,
  context: Context,
  routes: Routes,
  errorHandler: ((request: Request, e: Error) => Promise<Response | undefined>) | undefined = undefined,
  catchAll: Handler | undefined = undefined,
): Promise<APIGatewayProxyResult> {
  const request = parseRequest(event);

  let response: Response | undefined;
  try {
    const match = matchRoute(routes, request.path);
    if (match.params) request.pathParameters = match.params;

    if (match.methods) {
      const route = match.methods[request.method as keyof Route];
      if (!route) throw new ApiError(405, 'Method not allowed');

      // Verify request body
      if (route.request?.body) {
        const parsed = route.request.body.safeParse(request.body);
        if (!parsed.success) {
          throw new ApiError(400, z.treeifyError(parsed.error));
        }
        request.body = parsed.data;
      }

      response = await route.handler(request);

      // Verify response body
      if (route.response?.body) {
        const parsed = route.response.body.safeParse(response.body);
        if (!parsed.success) {
          console.error('Invalid response body:', request.method, request.path, JSON.stringify(z.treeifyError(parsed.error), null, 2));
          response = undefined; // Remove the response so it can be replaced by the error handler
          throw new ApiError(500, 'Internal server error');
        }
        response.body = parsed.data;
      }
    } else if (catchAll) {
      // Catch-all / 404
      response = await catchAll.handler(request);
    } else {
      throw new ApiError(404, 'Not found');
    }
  } catch (e) {
    if (errorHandler) {
      try {
        // errorHandler can optionally return undefined to request standard error handling:
        response = await errorHandler(request, e as Error);
      } catch (ee) {
        response = apiErrorResponse(ee);
      }
    }

    // Standard error handling
    response = response ?? apiErrorResponse(e);
  }

  // Translate the response to an API Gateway Proxy result
  let body: string | undefined;
  const headers = response.headers || {};
  if (typeof response.body === 'string') {
    // Use the body as-is
    // Add text/plain if no Content-Type header is set:
    if (!getHeader('Content-Type', headers)) setHeader('Content-Type', 'text/plain', headers);
    body = response.body;
  } else if (response.body) {
    // Stringify the response object
    // API Gateway returns application/json by default
    body = JSON.stringify(response.body);
  }

  // Prepare response
  const result: APIGatewayProxyResult = {
    statusCode: response.statusCode ?? 200,
    headers,
    body: body || '',
  };

  // Add cookie headers
  const cookieHeaders = buildCookie(response);
  if (cookieHeaders) {
    result.multiValueHeaders = {
      'Set-Cookie': cookieHeaders,
    };
  }

  return result;
}
