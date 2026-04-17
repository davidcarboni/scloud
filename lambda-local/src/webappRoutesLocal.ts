import * as http from 'http';
import * as path from 'path';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { buildEvent, readBody, sendResult, serveStaticFile } from './httpHelpers';

export interface CloudfrontPathMappings {
  [key: string]: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
}

export function webappRoutesLocal(cloudfrontPathMappings: CloudfrontPathMappings, staticContent?: string, debug = false) {
  const port = +(process.env.port || '3000');

  http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const body = await readBody(req);
    const event = buildEvent(req, body, url);

    if (debug) {
      console.log('Event:');
      console.log(event.httpMethod, event.path);
      console.log(JSON.stringify(event, null, 2));
    }

    try {
      const paths = Object.keys(cloudfrontPathMappings);

      // Try an exact match first, then fall back to prefix/wildcard matching
      let handler = cloudfrontPathMappings[event.path];
      paths.forEach((route) => {
        let partialMatch = route;
        // Strip leading slash:
        if (partialMatch.startsWith('/')) partialMatch = route.slice(1);
        // Remove trailing '*' wildcard:
        if (partialMatch.endsWith('*')) partialMatch = route.slice(0, -1);
        const candidate = event.path.startsWith(partialMatch) ? cloudfrontPathMappings[route] : undefined;
        handler = handler || candidate;
      });

      if (handler) {
        const result: APIGatewayProxyResult = await handler(event, {} as Context);

        if (debug) {
          console.log('Result:');
          console.log(event.httpMethod, event.path, result.statusCode);
          console.log(JSON.stringify(result, null, 2));
        }

        sendResult(res, result);
        return;
      }

      // Fall back to static file serving
      if (staticContent && serveStaticFile(path.join(staticContent, url.pathname), res)) return;

      console.log(`Unmatched path: ${event.path}`);
      res.writeHead(404);
      res.end(`Path not matched: ${event.path} (${paths})`);
    } catch (e) {
      console.log(e);
      console.log((e as Error).stack);
      res.writeHead(500);
      res.end(`${e}`);
    }
  }).listen(port, () => {
    console.log(`Lambda handler can be invoked at http://localhost:${port}`);
  });
}
