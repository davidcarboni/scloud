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

function errorResponse(statusCode: number, body: unknown, e?: unknown): Response {
  if (e) console.error(`Error in error handler: ${(e as Error).message}\n${(e as Error).stack}`);
  if (e instanceof ApiError) {
    return {
      statusCode: e.statusCode,
      body: e.body,
    };
  }
  return {
    statusCode: statusCode,
    body: body,
  };
}

/**
 * API route handler
 */
export async function apiHandler(
  event: APIGatewayProxyEvent,
  context: Context,
  routes: Routes = {
    '/ping': { GET: { handler: async (request) => ({ statusCode: 200, body: request }) } },
  },
  errorHandler: ((request: Request, e: Error) => Promise<Response>) | undefined = undefined,
  catchAll: Handler | undefined = undefined,
  // contextBuilder?: ContextBuilder,
): Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH}`);
  const request = parseRequest(event);

  let response: Response;
  try {
    const match = matchRoute(routes, request.path);
    if (match.params) request.pathParameters = match.params;

    if (match.methods) {
      const route = match.methods[request.method as keyof Route];
      if (!route) throw new ApiError(405, 'Method not allowed');
      response = await route.handler(request);
    } else if (catchAll) {
      // Catch-all / 404
      response = await catchAll.handler(request);
    } else {
      throw new ApiError(404, 'Not found');
    }
  } catch (e) {
    if (errorHandler) {
      try {
        response = await errorHandler(request, e as Error);
      } catch (ee) {
        response = errorResponse(500, 'Internal server error', ee);
      }
    } else {
      response = errorResponse(500, 'Internal server error', e);
    }
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
