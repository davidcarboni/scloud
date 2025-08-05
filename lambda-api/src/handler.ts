import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import {
  // ContextBuilder,
  Handler, Request, Response, Route, Routes,
} from './types';
import { buildCookie, buildHeaders, matchRoute, parseRequest } from './helpers';

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
    '/api/ping': { GET: { handler: async (request: Request) => ({ statusCode: 200, body: request }) } },
  },
  errorHandler: (request: Request, e: Error) => Promise<Response> = async (request: Request) => ({ statusCode: 500, body: { error: `Internal server error: ${request.path}` } }),
  catchAll: Handler = { handler: async (request: Request) => textResponse(404, `Not found: ${request.path}`) },
  // contextBuilder?: ContextBuilder,
): Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH}`);
  const request = parseRequest(event);

  let response: Response;
  try {
    const match = matchRoute(routes, request.path);
    if (!match.route) {
      // Catch-all / 404
      response = await catchAll.handler(request);
    } else {
      const handlerFunction = match.route[request.method as keyof Route];

      // Handle the request:
      if (handlerFunction) {
        // if (contextBuilder) await contextBuilder(request);
        response = await handlerFunction.handler({ ...request, pathParameters: match.params });
      } else {
        response = textResponse(405, 'Method not allowed');
      }
    }
  } catch (e) {
    // Fallback error handling
    console.error(`${(e as Error).message}\n${(e as Error).stack}`);
    response = textResponse(500, `Internal server error: ${request.path}`);
    try {
      // Error handling
      if (errorHandler) response = await errorHandler(request, e as Error);
    } catch (ee) {
      console.error(`Error in error handler: ${(ee as Error).message}\n${(ee as Error).stack}`);
    }
  }

  // API Gateway Proxy result
  let body: string = '';
  const headers = buildHeaders(response);
  if (typeof response.body === 'string') {
    // Use the body as-is
    // Potentially add a text/plain content type header:
    response.headers = { 'Content-Type': 'text/plain', ...headers };
    body = response.body;
  } else if (response.body) {
    // Stringify the response object
    // API Gateway returns application/json by default
    body = JSON.stringify(response.body);
  }
  const result: APIGatewayProxyResult = {
    statusCode: response.statusCode,
    body,
    headers: headers,
  };

  // Cookies (if set)
  const cookieHeaders = buildCookie(response);
  if (cookieHeaders) {
    result.multiValueHeaders = {
      'Set-Cookie': cookieHeaders,
    };
  }

  return result;
}
