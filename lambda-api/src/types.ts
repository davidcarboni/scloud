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

export interface Route<SReq extends z.ZodType<any, any, any> = z.ZodType<any, any, any>, SRes extends z.ZodType<any, any, any> = z.ZodType<any, any, any>> {
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

export interface Routes {
  [path: string]: {
    GET?: Route;
    POST?: Route;
    PUT?: Route;
    DELETE?: Route;
    PATCH?: Route;
    OPTIONS?: Route;
    HEAD?: Route;
  };
}
