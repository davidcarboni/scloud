/* eslint-disable @typescript-eslint/no-explicit-any */
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

// export interface RequestSchema {
//   context?: z.ZodType;
//   headers?: z.ZodType;
//   cookies?: z.ZodType;
//   pathParameters?: z.ZodType;
//   query?: z.ZodType;
//   body?: z.ZodType;
// }

// export interface ResponseSchema {
//   headers?: z.ZodType;
//   cookies?: z.ZodType;
//   body?: z.ZodType;
// }

type SchemaRecord = { [key: string]: z.ZodType<any, any, any>; };

export interface RequestSchema {
  headers?: z.ZodObject<SchemaRecord>;
  query?: z.ZodObject<SchemaRecord>;
  cookies?: z.ZodObject<SchemaRecord>;
  pathParameters?: z.ZodObject<SchemaRecord>;
  body?: z.ZodType<any>; // optional for flexibility
}

export interface ResponseSchema {
  headers?: z.ZodObject<SchemaRecord>;
  cookies?: z.ZodObject<SchemaRecord>;
  body: z.ZodObject<SchemaRecord>; // required and enforced
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

  context: { [key: string]: any; },
}

export interface Response<Res extends ResponseSchema = ResponseSchema> {
  statusCode: number,
  headers?: InferSchema<Res['headers']>,
  cookies?: InferSchema<Res['cookies']>,
  body: InferSchema<Res['body']>;
}

export interface Handler<Req extends RequestSchema = RequestSchema, Res extends ResponseSchema = ResponseSchema> {
  requestSchema?: Req;
  responseSchema?: Res;
  handler: (request: Request<Req>) => Promise<{ // Seems we need to inline this, rather than use Promise<Response<Res>>
    statusCode: number;
    headers?: InferSchema<Res["headers"]>;
    cookies?: InferSchema<Res["cookies"]>;
    body: InferSchema<Res["body"]>;
  }>;
}

export interface Route {
  GET?: Handler;
  POST?: Handler;
  PUT?: Handler;
  DELETE?: Handler;
  OPTIONS?: Handler;
}

export interface Routes { [path: string]: Route; }

/**
 * Ensures typing for a handler.
 */
// export function defineHandler<
//   Req extends RequestSchema,
//   Res extends ResponseSchema
// >(
//   def: {
//     requestSchema: Req;
//     responseSchema: Res;
//     handler: (request: Request<Req>) => Promise<{
//       statusCode: number;
//       headers?: InferSchema<Res["headers"]>;
//       cookies?: InferSchema<Res["cookies"]>;
//       body: InferSchema<Res["body"]>;
//     }>;
//   }
// ): typeof def {
//   return def;
// }

// export function defineHandler<
//   Req extends RequestSchema,
//   Res extends ResponseSchema
// >(
//   requestSchema: Req,
//   responseSchema: Res,
//   handler: (request: Request<Req>) => Promise<{
//     statusCode: number;
//     headers?: InferSchema<Res["headers"]>;
//     cookies?: InferSchema<Res["cookies"]>;
//     body: InferSchema<Res["body"]>;
//   }>
// ): Handler<Req, Res> {
//   return { requestSchema, responseSchema, handler };
// }

// export function defineRequestSchema<T extends RequestSchema>(schema: T): T {
//   return schema;
// }

// export function defineResponseSchema<T extends ResponseSchema>(schema: T): T {
//   return schema;
// }

export function defineHandler<
  Req extends RequestSchema,
  Res extends {
    headers?: z.ZodObject<any>;
    cookies?: z.ZodObject<any>;
    body: z.ZodObject<any>; // ✅ Enforce object shape!
  }
>(
  requestSchema: Req,
  responseSchema: Res,
  handler: (request: Request<Req>) => Promise<{
    statusCode: number;
    headers?: z.infer<Res["headers"]>;
    cookies?: z.infer<Res["cookies"]>;
    body: z.infer<Res["body"]>;
  }>
): Handler<Req, Res> {
  return { requestSchema, responseSchema, handler };
}

export function defineRequestSchema<
  T extends {
    headers?: z.ZodObject<any>;
    cookies?: z.ZodObject<any>;
    query?: z.ZodObject<any>;
    body: z.ZodObject<any>;
  }
>(schema: T): T {
  return schema;
}

// export function defineResponseSchema<
//   T extends {
//     headers?: z.ZodObject<any>;
//     cookies?: z.ZodObject<any>;
//     body: z.ZodObject<any>;
//   }
// >(schema: T): T {
//   return schema;
// }

export function defineResponseSchema<
  H extends z.ZodObject<any> | undefined,
  C extends z.ZodObject<any> | undefined,
  B extends z.ZodObject<any>
>(schema: {
  headers?: H;
  cookies?: C;
  body: B;
}): {
  headers?: H;
  cookies?: C;
  body: B;
} {
  return schema;
}

// export type ContextBuilder = (request: Request) => Promise<void>;

