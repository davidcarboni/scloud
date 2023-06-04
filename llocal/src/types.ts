export interface Request {
  method: string,
  path: string,
  query: { [name: string]: string; },
  headers: { [name: string]: string; },
  cookies: { [name: string]: string; },
  body: { [name: string]: string; },
}

export interface Response {
  statusCode: number,
  headers?: { [name: string]: string; },
  cookies?: { [name: string]: string; },
  body?: { [name: string]: any; },
}

// eslint-disable-next-line no-unused-vars
export type Handler = (request: Request) => Promise<Response>;
export interface Route {
  GET?: Handler,
  POST?: Handler,
  PUT?: Handler,
  DELETE?: Handler,
  OPTIONS?: Handler,
}
export interface Routes { [path: string]: Route; }
