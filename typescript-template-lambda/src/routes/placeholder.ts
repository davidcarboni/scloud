/* eslint-disable import/prefer-default-export */
import { Request, Response } from '@scloud/lambda-api/dist/types';

export async function placeholder(request: Request): Promise<Response> {
  return {
    statusCode: 200,
    body: { request: JSON.stringify(request) },
  };
}
