import * as http from 'http';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { buildEvent, readBody, sendResult } from './httpHelpers';

export interface CloudfrontPathMappings {
  [key: string]: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
}

export function cloudfrontLocal(cloudfrontPathMappings: CloudfrontPathMappings, debug = false) {
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

      // Try a simple mapping
      let handler = cloudfrontPathMappings[event.path];

      // Fall back to a '*' match:
      paths.forEach((path) => {
        let partialMatch = path;
        // Strip leading slash:
        if (partialMatch.startsWith('/')) {
          partialMatch = path.slice(1);
        }
        // Remove trailing '*' wildcard:
        if (partialMatch.endsWith('*')) {
          partialMatch = path.slice(0, -1);
        }
        // Get the first match:
        const candidate = event.path.startsWith(partialMatch) ? cloudfrontPathMappings[path] : undefined;
        handler = handler || candidate;
      });

      // Invoke the function handler:
      const result: APIGatewayProxyResult = handler ? await handler(event, {} as Context) : { statusCode: 404, body: `Path not matched: ${event.path} (${paths})` };

      if (debug) {
        console.log('Result:');
        console.log(event.httpMethod, event.path, result.statusCode);
        console.log(JSON.stringify(result, null, 2));
      }

      sendResult(res, result);
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
