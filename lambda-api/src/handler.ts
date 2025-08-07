import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import {
  Request, Response, Handler, Route, Routes,
} from './types';
import { buildCookie, getHeader, matchRoute, parseRequest, setHeader } from './helpers';

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
    '/ping': { GET: { handler: async (request) => ({ statusCode: 200, body: request }) } },
  },
  errorHandler: (request: Request, e: Error) => Promise<Response> = async (request: Request, e: Error) => { console.log('Error:', request.method, request.path, e); return { statusCode: 500, body: { error: 'Internal server error' } }; },
  catchAll: Handler = { handler: async () => textResponse(404, 'Not found') },
  // contextBuilder?: ContextBuilder,
): Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH}`);
  const request = parseRequest(event);

  let response: Response;
  try {
    const match = matchRoute(routes, request.path);
    if (match.methods) {
      const route = match.methods[request.method as keyof Route];

      // Handle the request:
      if (route) {
        // if (contextBuilder) await contextBuilder(request);
        request.pathParameters = match.params;
        response = await route.handler(request);
      } else {
        response = textResponse(405, 'Method not allowed');
      }
    } else {
      // Catch-all / 404
      response = await catchAll.handler(request);
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

  const result: APIGatewayProxyResult = {
    statusCode: response.statusCode ?? 200,
    body: body || '',
    headers,
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
