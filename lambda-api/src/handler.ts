import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import {
  Handler, Request, Response, Route, Routes,
} from './types';
import { buildCookie, matchRoute, parseRequest } from './helpers';

function textResponse(statusCode: number, body: string): Response {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/plain' },
    body
  };
}

/**
 * API route handler
 */
export async function apiHandler(
  event: APIGatewayProxyEvent,
  context: Context,
  routes: Routes = {
    '/api/ping': { GET: async (request: Request) => ({ statusCode: 200, body: request }) },
  },

  errorHandler: (request: Request, e: Error) => Promise<Response> = async (request: Request) => ({ statusCode: 500, body: { error: `Internal server error: ${request.path}` } }),
  catchAll: Handler = async (request: Request) => textResponse(404, `Not found: ${request.path}`),
): Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH}`);
  const request = parseRequest(event);

  let response: Response;
  try {
    const route = matchRoute(routes, request.path);
    if (!route) {
      // Catch-all / 404
      response = await catchAll(request);
    } else {
      const handlerFunction = route[request.method as keyof Route];

      // Handle the request:
      if (handlerFunction) response = await handlerFunction(request);
      else response = textResponse(405, 'Method not allowed');
    }
  } catch (e) {
    // Fallback error handling
    console.error(`${(e as Error).message}\n${(e as Error).stack}`);
    response = textResponse(500, `Internal server error: ${request.path}`);
    try {
      // Error handling
      if (errorHandler) response = await errorHandler(request, e as Error);
    } catch (ee) {
      console.error(`Error in error handler: ${(e as Error).message}\n${(e as Error).stack}`);
    }
  }

  // API Gateway Proxy result
  let body: string = '';
  if (typeof response.body === 'string') {
    // Use the body as-is
    // Potentially add a text/plain content type header:
    response.headers = { 'Content-Type': 'text/plain', ...response.headers };
    body = response.body;
  } else if (response.body) {
    // Stringify the response object
    // API Gateway returns applicatipno/json by default
    body = JSON.stringify(response.body);
  }
  const result: APIGatewayProxyResult = {
    statusCode: response.statusCode,
    body,
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
}
