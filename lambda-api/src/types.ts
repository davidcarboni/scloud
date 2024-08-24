/**
 * Simplified representation of the HTTP Request.
 * The implementation guarantees that you'll always have non-null objects for query, headers, cookies, and body.
 * The method will be the HTTP method from the API Gateway proxt event.
 * The path will be the path from the API Gateway proxy event, which starts with '/'.
 */
export interface Request {
  method: string,
  path: string,
  query: { [name: string]: string; },
  headers: { [name: string]: string; },
  cookies: { [name: string]: string; },
  /** Path parameters will be parsed from the route definitions you pass to apiHandler() */
  pathParameters: { [name: string]: string; },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  /** You can add any custom values you need to the request via this context */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { [key: string]: any; },
}

export interface Response {
  statusCode: number,
  headers?: { [name: string]: string; },
  cookies?: { [name: string]: string; },
  body?: object | string,
}

export type Handler = (request: Request) => Promise<Response>;
export interface Route {
  GET?: Handler,
  POST?: Handler,
  PUT?: Handler,
  DELETE?: Handler,
  OPTIONS?: Handler,
}
export interface Routes { [path: string]: Route; }
