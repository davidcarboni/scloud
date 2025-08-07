/* eslint-disable @typescript-eslint/no-explicit-any */
import { APIGatewayProxyEvent } from "aws-lambda";
import z from "zod";

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
export interface Handler<SReq extends AnySchema = AnySchema, SRes extends AnySchema = AnySchema> {
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
  GET?: Handler;
  POST?: Handler;
  PUT?: Handler;
  DELETE?: Handler;
  PATCH?: Handler;
  OPTIONS?: Handler;
  HEAD?: Handler;
}

export interface Routes {
  [path: string]: Route;
}
