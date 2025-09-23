/* eslint-disable @typescript-eslint/no-explicit-any */
import { APIGatewayProxyEvent } from "aws-lambda";
import z from "zod/v4";

export interface Request<B = any> {
  method: string,
  path: string,
  query: Record<string, string>;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  pathParameters: Record<string, string>;
  body: B;
  context: {
    event: APIGatewayProxyEvent;
    [key: string]: any;
  },
}

export interface Response<B = any> {
  statusCode?: number;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  body?: B;
}

type AnySchema = z.ZodType<any, any, any>;
export interface Handler<SReq extends AnySchema | undefined = undefined, SRes extends AnySchema | undefined = undefined> {
  request?: {
    body?: SReq;
    headers?: z.ZodObject<any>;
    cookies?: z.ZodObject<any>;
    pathParameters?: z.ZodObject<any>;
    query?: z.ZodObject<any>;
  };
  response?: {
    body?: SRes;
    headers?: z.ZodObject<any>;
    cookies?: z.ZodObject<any>;
  };
  handler: (request: Request<z.infer<SReq>>) => Promise<Response<z.infer<SRes>>>;
}

export interface Route {
  GET?: Handler<undefined, AnySchema>;
  POST?: Handler<AnySchema, AnySchema>;
  PUT?: Handler<AnySchema, AnySchema>;
  DELETE?: Handler<undefined, AnySchema>;
  PATCH?: Handler<undefined, AnySchema>;
  OPTIONS?: Handler<undefined, AnySchema>;
  HEAD?: Handler<undefined, AnySchema>;
}

export interface Routes {
  [path: string]: Route;
}

export class ApiError extends Error {
  statusCode: number;
  body: unknown;

  constructor(statusCode: number, body: unknown) {
    super(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
    this.statusCode = statusCode;
    this.body = body;

    // Required for instanceof to work properly
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
