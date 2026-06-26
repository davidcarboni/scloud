/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { APIGatewayProxyEvent, APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { apiHandler } from '../src/handler';
import { Request } from '../src/types';
import z from 'zod/v4';

const event: APIGatewayProxyEvent = {} as APIGatewayProxyEvent;
const context: Context = {} as Context;

function v2Event(overrides: Partial<APIGatewayProxyEventV2> & { method?: string; path?: string; }): APIGatewayProxyEventV2 {
  const method = overrides.method ?? 'GET';
  const path = overrides.path ?? '/';
  const { method: _m, path: _p, ...rest } = overrides;

  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'api-id.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'api-id',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request-id',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2020:00:00:00 +0000',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    ...rest,
  };
}

describe('handler.ts', () => {
  describe('handler', () => {
    it('Should return 200 for a matched route', async () => {
      const request = { ...event, path: '/ok', httpMethod: 'GET' };
      const routes = {
        '/ok': {
          GET: { handler: async (r: Request) => ({ statusCode: 200, body: '' }) },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(200);
    });

    it('Should find path parameters', async () => {
      const request = { ...event, path: '/ok/123', httpMethod: 'GET' };
      const routes = {
        '/ok/{id}': {
          GET: { handler: async (r: Request) => ({ statusCode: 200, body: r.pathParameters.id }) },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(200);
      expect(result.body).to.equal('123');
    });

    it('Should parse request body', async () => {
      const request = { ...event, path: '/ok', httpMethod: 'POST', body: JSON.stringify({ id: '123' }) };
      const routes = {
        '/ok': {
          POST: {
            request: { body: z.object({ id: z.string() }) },
            handler: async (r: Request) => ({ statusCode: 200, body: r.body.id })
          },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(200);
      expect(result.body).to.equal('123');
    });

    it('Should return 400 for an invalid request body', async () => {
      const request = { ...event, path: '/ok', httpMethod: 'POST', body: JSON.stringify({ invalid: '123' }) };
      const routes = {
        '/ok': {
          POST: {
            request: { body: z.object({ id: z.string() }) },
            handler: async (r: Request) => ({ statusCode: 200, body: r.body.id })
          },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(400);
    });

    it('Should parse response body', async () => {
      const request = { ...event, path: '/ok', httpMethod: 'POST', body: JSON.stringify({ id: '123' }) };
      const routes = {
        '/ok': {
          POST: {
            response: { body: z.object({ id: z.string() }) },
            handler: async (r: Request) => ({ statusCode: 200, body: { id: '123' } })
          },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(200);
      expect(JSON.parse(result.body)).to.deep.equal({ id: '123' });
    });

    it('Should return 500 for an invalid response body', async () => {
      const request = { ...event, path: '/ok', httpMethod: 'POST', body: JSON.stringify({ id: '123' }) };
      const routes = {
        '/ok': {
          POST: {
            response: { body: z.object({ id: z.string() }) },
            handler: async (r: Request) => ({ statusCode: 200, body: 123 })
          },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(500);
    });

    it('Should return 404 for an unmatched path', async () => {
      const request = { ...event, path: '/unmatched', httpMethod: 'GET' };
      const routes = {
        '/ok': {
          GET: {
            handler: async (r: Request) => ({})
          },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(404);
    });

    it('Should return 405 for an unmatched method', async () => {
      const request = { ...event, path: '/get', httpMethod: 'POST' };
      const routes = {
        '/get': {
          GET: {
            handler: async (r: Request) => ({})
          },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(405);
    });

    it('Should return 500 for an error', async () => {
      const request = { ...event, path: '/error', httpMethod: 'GET' };
      const routes = {
        '/error': {
          GET: {
            handler: async (r: Request) => {
              throw new Error('Intended error');
            }
          },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(500);
    });

    it('Should call a custom error handler', async () => {
      const request = { ...event, path: '/error', httpMethod: 'GET' };
      const routes = {
        '/error': {
          GET: {
            handler: async (r: Request) => {
              throw new Error('Intended error');
            }
          },
        },
      };
      const errorHandler = async (r: Request, e: Error) => ({ statusCode: 111, body: 'handled' });
      const result = await apiHandler(request, context, routes, errorHandler);
      expect(result.statusCode).to.equal(111);
      expect(result.body).to.equal('handled');
    });

    it('Should set response cookies on v1 events', async () => {
      const request = { ...event, path: '/ok', httpMethod: 'GET' };
      const routes = {
        '/ok': {
          GET: { handler: async () => ({ statusCode: 200, cookies: { session: 'abc123' } }) },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.multiValueHeaders?.['Set-Cookie']?.[0]).to.include('session=abc123');
    });

    it('Should return 500 for an error in a custom error handler', async () => {
      const request = { ...event, path: '/error', httpMethod: 'GET' };
      const routes = {
        '/error': {
          GET: {
            handler: async (r: Request) => {
              throw new Error('Intended error');
            }
          },
        },
      };
      const errorHandler = async (r: Request, e: Error) => { throw new Error('Intended error in custom error handler'); };
      const result = await apiHandler(request, context, routes, errorHandler);
      expect(result.statusCode).to.equal(500);
      expect(result.body).to.equal('Internal server error');
    });
  });

  describe('apiHandler with v2 Function URL events', () => {
    it('Should return 200 for a matched route', async () => {
      const request = v2Event({ path: '/ok', method: 'GET' });
      const routes = {
        '/ok': {
          GET: { handler: async () => ({ statusCode: 200, body: '' }) },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(200);
    });

    it('Should find path parameters', async () => {
      const request = v2Event({ path: '/ok/123', method: 'GET' });
      const routes = {
        '/ok/{id}': {
          GET: { handler: async (r: Request) => ({ statusCode: 200, body: r.pathParameters.id }) },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(200);
      expect(result.body).to.equal('123');
    });

    it('Should parse cookies from the event cookies array', async () => {
      const request = v2Event({
        path: '/ok',
        method: 'GET',
        cookies: ['session=abc123'],
      });
      const routes = {
        '/ok': {
          GET: { handler: async (r: Request) => ({ statusCode: 200, body: r.cookies.session }) },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.statusCode).to.equal(200);
      expect(result.body).to.equal('abc123');
    });

    it('Should set response cookies', async () => {
      const request = v2Event({ path: '/ok', method: 'GET' });
      const routes = {
        '/ok': {
          GET: { handler: async () => ({ statusCode: 200, cookies: { session: 'abc123' } }) },
        },
      };
      const result = await apiHandler(request, context, routes);
      expect(result.cookies?.[0]).to.include('session=abc123');
    });
  });
});
