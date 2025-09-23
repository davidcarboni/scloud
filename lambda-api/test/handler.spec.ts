/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { apiHandler } from '../src/handler';
import { Request } from '../src/types';
import z from 'zod/v4';

const event: APIGatewayProxyEvent = {} as APIGatewayProxyEvent;
const context: Context = {} as Context;

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
});
