import {
  APIGatewayProxyResult,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { buildCookie, getHeader, setHeader } from './helpers';
import { Response } from './types';

function prepareResponseBody(response: Response): { headers: Record<string, string>; body: string; } {
  const headers = { ...(response.headers || {}) };
  let body = '';

  if (typeof response.body === 'string') {
    if (!getHeader('Content-Type', headers)) setHeader('Content-Type', 'text/plain', headers);
    body = response.body;
  } else if (response.body) {
    body = JSON.stringify(response.body);
  }

  return { headers, body };
}

export function toApiGatewayResultV1(response: Response): APIGatewayProxyResult {
  const { headers, body } = prepareResponseBody(response);

  const result: APIGatewayProxyResult = {
    statusCode: response.statusCode ?? 200,
    headers,
    body,
  };

  const cookieHeaders = buildCookie(response);
  if (cookieHeaders) {
    result.multiValueHeaders = { 'Set-Cookie': cookieHeaders };
  }

  return result;
}

export function toApiGatewayResultV2(response: Response): APIGatewayProxyStructuredResultV2 {
  const { headers, body } = prepareResponseBody(response);

  const result: APIGatewayProxyStructuredResultV2 = {
    statusCode: response.statusCode ?? 200,
    headers,
    body,
  };

  const cookieHeaders = buildCookie(response);
  if (cookieHeaders) {
    result.cookies = cookieHeaders;
  }

  return result;
}
