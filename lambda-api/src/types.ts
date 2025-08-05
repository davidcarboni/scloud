/**
 * Simplified representation of the HTTP Request.
 * The implementation guarantees that you'll always have non-null objects for query, headers, cookies, and body.
 * The method will be the HTTP method from the API Gateway proxt event.
 * The path will be the path from the API Gateway proxy event, which starts with '/'.
 */

import { z } from "zod";


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stringRecord = z.record(z.string(), z.string());
type StringRecord = z.infer<typeof stringRecord>;

export interface RequestSchema {
  context?: z.ZodType;
  headers?: z.ZodType;
  cookies?: z.ZodType;
  pathParameters?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

export interface ResponseSchema {
  headers?: z.ZodType;
  cookies?: z.ZodType;
  body?: z.ZodType;
}

type InferSchema<T> = T extends z.ZodType ? z.infer<T> : z.infer<StringRecord>;

export interface Request<R extends RequestSchema = RequestSchema> {
  method: string,
  path: string,
  query: InferSchema<R['query']>,
  headers: InferSchema<R['headers']>,
  cookies: InferSchema<R['cookies']>,
  /** Path parameters will be parsed from the route definitions you pass to apiHandler() */
  pathParameters: InferSchema<R['pathParameters']>,
  body: InferSchema<R['body']>,
  /** You can add any custom values you need to the request via this context */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { [key: string]: any; },
}

export interface Response<R extends ResponseSchema = ResponseSchema> {
  statusCode: number,
  headers?: InferSchema<R['headers']>,
  cookies?: InferSchema<R['cookies']>,
  body: InferSchema<R['body']>;
}

export interface Handler<Req extends RequestSchema = RequestSchema, Res extends ResponseSchema = ResponseSchema> {
  requestSchema?: Req;
  responseSchema?: Res;
  handler: (
    request: Request<Req>,
  ) => Promise<Response<Res>>;
}

export interface Route {
  GET?: Handler;
  POST?: Handler;
  PUT?: Handler;
  DELETE?: Handler;
  OPTIONS?: Handler;
}

export interface Routes { [path: string]: Route; }

export function defineHandler<Req extends RequestSchema, Res extends ResponseSchema>(
  def: Handler<Req, Res>
): Handler<Req, Res> {
  return def;
}

// export type ContextBuilder = (request: Request) => Promise<void>;

