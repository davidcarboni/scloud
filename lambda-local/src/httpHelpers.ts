import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function buildEvent(req: http.IncomingMessage, body: string, url: URL): APIGatewayProxyEvent {
  // Headers
  const headers: Record<string, string | undefined> = {};
  const multiValueHeaders: Record<string, string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) {
      headers[key] = undefined;
      multiValueHeaders[key] = undefined;
    } else if (typeof value === 'string') {
      headers[key] = value;
      multiValueHeaders[key] = [value];
    } else if (Array.isArray(value)) {
      multiValueHeaders[key] = value;
    }
  }

  // Query string
  const queryStringParameters: Record<string, string | undefined> = {};
  const multiValueQueryStringParameters: Record<string, string[] | undefined> = {};
  const seen = new Set<string>();
  for (const [key, value] of url.searchParams.entries()) {
    if (!seen.has(key)) {
      seen.add(key);
      queryStringParameters[key] = value;
      const allValues = url.searchParams.getAll(key);
      if (allValues.length > 1) multiValueQueryStringParameters[key] = allValues;
    }
  }

  const protocol = (req.socket as unknown as { encrypted?: boolean }).encrypted ? 'https' : 'http';

  return {
    body,
    headers,
    multiValueHeaders,
    httpMethod: req.method || 'GET',
    path: url.pathname,
    queryStringParameters,
    multiValueQueryStringParameters,
    requestContext: {
      httpMethod: req.method || 'GET',
      path: url.pathname,
      protocol,
    } as unknown as APIGatewayProxyEvent['requestContext'],
  } as unknown as APIGatewayProxyEvent;
}

export function sendResult(res: http.ServerResponse, result: APIGatewayProxyResult): void {
  res.statusCode = result.statusCode;
  for (const [key, values] of Object.entries(result.multiValueHeaders || {})) {
    if (values) res.setHeader(key, values.map((v) => `${v}`));
  }
  for (const [key, value] of Object.entries(result.headers || {})) {
    if (value !== undefined) res.setHeader(key, `${value}`);
  }
  res.end(result.body ?? '');
}

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.eot': 'application/vnd.ms-fontobject',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.mjs': 'application/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Serves a file from disk. Returns true if the file was found and served. */
export function serveStaticFile(filePath: string, res: http.ServerResponse): boolean {
  if (!fs.existsSync(filePath)) return false;
  let resolved = filePath;
  if (fs.statSync(resolved).isDirectory()) {
    resolved = path.join(resolved, 'index.html');
    if (!fs.existsSync(resolved)) return false;
  }
  const contentType = MIME_TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(resolved).pipe(res);
  return true;
}
