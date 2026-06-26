import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import {
  Request, Response, Handler, Route, Routes,
  ApiError,
} from './types';
import { ApiGatewayProxyEventAny, ApiGatewayProxyResultFor, isApiGatewayEventV2 } from './event';
import { matchRoute, parseRequest } from './helpers';
import { toApiGatewayResultV1, toApiGatewayResultV2 } from './result';
import z from 'zod/v4';

type ErrorHandler = (request: Request, e: Error) => Promise<Response | undefined>;

function apiErrorResponse(e?: unknown): Response {
  if (e instanceof ApiError) {
    return {
      headers: e.headers,
      statusCode: e.statusCode,
      body: e.body,
    };
  }

  if (e) console.error(e);
  return {
    statusCode: 500,
    body: 'Internal server error',
  };
}

async function handleRequest(
  event: ApiGatewayProxyEventAny,
  routes: Routes,
  errorHandler: ErrorHandler | undefined,
  catchAll: Handler | undefined,
): Promise<Response> {
  const request = parseRequest(event);

  let response: Response | undefined;
  try {
    const match = matchRoute(routes, request.path);
    if (match.params) request.pathParameters = match.params;

    if (match.methods) {
      const route = match.methods[request.method as keyof Route];
      if (!route) throw new ApiError(405, 'Method not allowed');

      if (route.request?.body) {
        const parsed = route.request.body.safeParse(request.body);
        if (!parsed.success) {
          throw new ApiError(400, z.treeifyError(parsed.error));
        }
        request.body = parsed.data;
      }

      response = await route.handler(request);

      if (route.response?.body) {
        const parsed = route.response.body.safeParse(response.body);
        if (!parsed.success) {
          console.error('Invalid response body:', request.method, request.path, JSON.stringify(z.treeifyError(parsed.error), null, 2));
          response = undefined;
          throw new ApiError(500, 'Internal server error');
        }
        response.body = parsed.data;
      }
    } else if (catchAll) {
      response = await catchAll.handler(request);
    } else {
      throw new ApiError(404, 'Not found');
    }
  } catch (e) {
    if (errorHandler) {
      try {
        response = await errorHandler(request, e as Error);
      } catch (ee) {
        response = apiErrorResponse(ee);
      }
    }

    response = response ?? apiErrorResponse(e);
  }

  return response;
}

/**
 * API route handler
 */
export async function apiHandler(
  event: APIGatewayProxyEventV2,
  context: Context,
  routes: Routes,
  errorHandler?: ErrorHandler,
  catchAll?: Handler,
): Promise<APIGatewayProxyStructuredResultV2>;
export async function apiHandler(
  event: APIGatewayProxyEvent,
  context: Context,
  routes: Routes,
  errorHandler?: ErrorHandler,
  catchAll?: Handler,
): Promise<APIGatewayProxyResult>;
export async function apiHandler<E extends ApiGatewayProxyEventAny>(
  event: E,
  context: Context,
  routes: Routes,
  errorHandler?: ErrorHandler,
  catchAll?: Handler,
): Promise<ApiGatewayProxyResultFor<E>>;
export async function apiHandler(
  event: ApiGatewayProxyEventAny,
  context: Context,
  routes: Routes,
  errorHandler?: ErrorHandler,
  catchAll?: Handler,
): Promise<APIGatewayProxyResult | APIGatewayProxyStructuredResultV2> {
  const response = await handleRequest(event, routes, errorHandler, catchAll);
  return isApiGatewayEventV2(event)
    ? toApiGatewayResultV2(response)
    : toApiGatewayResultV1(response);
}
