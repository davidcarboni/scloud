import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { buildEvent, readBody, sendResult, serveStaticFile } from './httpHelpers';

export function webappLocal(
  handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>,
  staticContent?: { sourceDirectory: string, appPath: string; },
  debug = false,
) {
  if (staticContent?.sourceDirectory) {
    if (!fs.existsSync(staticContent.sourceDirectory)) {
      throw new Error(`Static directory not found: ${staticContent.sourceDirectory}`);
    }
  }

  const port = +(process.env.PORT || '3000');

  http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    // Allow all origins for local development
    const origin = req.headers['origin'] || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // "Static bucket" serving
    if (staticContent) {
      const prefix = staticContent.appPath;
      if (url.pathname === prefix || url.pathname.startsWith(prefix + '/')) {
        const relative = url.pathname.slice(prefix.length) || '/';
        if (serveStaticFile(path.join(staticContent.sourceDirectory, relative), res)) return;
      }
    }

    // Route everything else to the Lambda handler function
    const body = await readBody(req);
    const event = buildEvent(req, body, url);

    if (debug) {
      console.log('Event:');
      console.log(event.httpMethod, event.path);
      console.log(JSON.stringify(event, null, 2));
    }

    try {
      const result = await handler(event, {} as Context);

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
