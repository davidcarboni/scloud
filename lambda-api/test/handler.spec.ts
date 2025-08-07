/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { apiHandler } from '../src/handler';
import { Request } from '../src/types';
import z from 'zod';

const event: APIGatewayProxyEvent = {} as APIGatewayProxyEvent;
const context: Context = {} as Context;

describe('handler.ts', () => {
  describe('handler', () => {
    it('Should return 200 for a matched route', async () => {
      const result = await apiHandler({ ...event, path: '/ok', httpMethod: 'GET' }, context, {
        '/ok': {
          GET: { handler: async (r: Request) => ({ statusCode: 200, body: '' }) },
        },
      });
      expect(result.statusCode).to.equal(200);
    });

    it('Should find path parameters', async () => {
      const result = await apiHandler({ ...event, path: '/ok/123', httpMethod: 'GET' }, context, {
        '/ok/{id}': {
          GET: { handler: async (r: Request) => ({ statusCode: 200, body: r.pathParameters.id }) },
        },
      });
      expect(result.statusCode).to.equal(200);
      expect(result.body).to.equal('123');
    });

    it('Should parse request body', async () => {
      const result = await apiHandler({ ...event, path: '/ok', httpMethod: 'POST', body: JSON.stringify({ id: '123' }) }, context, {
        '/ok': {
          POST: {
            request: { body: z.object({ id: z.string() }) },
            handler: async (r: Request) => ({ statusCode: 200, body: r.body.id })
          },
        },
      });
      expect(result.statusCode).to.equal(200);
      expect(result.body).to.equal('123');
    });

    it('Should return 400 for an invalid request body', async () => {
      const result = await apiHandler({ ...event, path: '/ok', httpMethod: 'POST' }, context, {
        '/ok': {
          POST: {
            request: { body: z.object({ id: z.string() }) },
            handler: async (r: Request) => ({ statusCode: 200, body: r.body.id })
          },
        },
      });
      expect(result.statusCode).to.equal(400);
    });

    it('Should parse response body', async () => {
      const result = await apiHandler({ ...event, path: '/ok', httpMethod: 'POST', body: JSON.stringify({ id: '123' }) }, context, {
        '/ok': {
          POST: {
            response: { body: z.object({ id: z.string() }) },
            handler: async (r: Request) => ({ statusCode: 200, body: { id: '123' } })
          },
        },
      });
      expect(result.statusCode).to.equal(200);
      expect(JSON.parse(result.body)).to.deep.equal({ id: '123' });
    });

    it('Should return 500 for an invalid response body', async () => {
      const result = await apiHandler({ ...event, path: '/ok', httpMethod: 'POST', body: JSON.stringify({ id: '123' }) }, context, {
        '/ok': {
          POST: {
            response: { body: z.object({ id: z.string() }) },
            handler: async (r: Request) => ({ statusCode: 200, body: 123 })
          },
        },
      });
      expect(result.statusCode).to.equal(500);
    });

    it('Should return 404 for an unmatched path', async () => {
      const result = await apiHandler({ ...event, path: '/unmatched' }, context);
      expect(result.statusCode).to.equal(404);
    });

    it('Should return 405 for an unmatched method', async () => {
      const result = await apiHandler({ ...event, path: '/method', httpMethod: 'GET' }, context, {
        '/method': {
          POST: { handler: async (r: Request) => ({ statusCode: 200, body: { method: 'POST' } }) },
        },
      });
      expect(result.statusCode).to.equal(405);
    });

    it('Should return 500 for an error', async () => {
      const result = await apiHandler({ ...event, path: '/boom', httpMethod: 'GET' }, context, {
        '/boom': {
          GET: {
            handler: async (r: Request) => {
              throw new Error('Intended error');
            }
          },
        },
      });
      expect(result.statusCode).to.equal(500);
    });

    it('Should call a custom error handler', async () => {
      const result = await apiHandler({ ...event, path: '/boom', httpMethod: 'GET' }, context, {
        '/boom': {
          GET: {
            handler: async (r: Request) => {
              throw new Error('Intended error');
            }
          },
        },
      },
        async (r: Request, e: Error) => ({ statusCode: 111, body: 'handled' }),
      );
      expect(result.statusCode).to.equal(111);
      expect(result.body).to.equal('handled');
    });

    it('Should return 500 for an error in a custom error handler', async () => {
      const result = await apiHandler({ ...event, path: '/boom', httpMethod: 'GET' }, context, {
        '/boom': {
          GET: {
            handler: async (r: Request) => {
              throw new Error('Intended error');
            }
          },
        },
      },
        async (r: Request, e: Error) => { throw new Error('Intended error in custom error handler'); },
      );
      expect(result.statusCode).to.equal(500);
      expect(result.body).to.equal('Internal server error');
    });
  });
});
