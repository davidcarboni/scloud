import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import {
  Handler, Request, Response, Route, Routes,
} from './types';
import { buildCookie, matchRoute, parseRequest } from './helpers';

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
  catchAll: Handler = async (request: Request) => ({ statusCode: 404, body: { error: `Not found: ${request.path}` } }),
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
      if (!handlerFunction) return { statusCode: 405, body: JSON.stringify('Method not allowed') };

      // Handle the request:
      response = await handlerFunction(request);
    }
  } catch (e) {
    console.error(`${(e as Error).message}\n${(e as Error).stack}`);
    try {
      // Error handling
      response = await errorHandler(request, e as Error);
    } catch (ee) {
      response = { statusCode: 500, body: { error: `Internal server error: ${request.path} [errorHandler]` } };
    }
  }

  // API Gateway Proxy result
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
}
