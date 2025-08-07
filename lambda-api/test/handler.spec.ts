/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { apiHandler } from '../src/handler';
import { Request } from '../src/types';

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
  });
});
