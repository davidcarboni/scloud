import * as fs from 'fs';
import express, { Request, Response } from 'express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

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
  const app = express();

  // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
  app.use(express.text({ type: '*/*', limit: '6mb' }));

  // "Static bucket" serving
  if (staticContent) app.use(staticContent.appPath, express.static(staticContent.sourceDirectory));

  // Route everything else to the Lambda handler function
  app.all('/*', async (req: Request, res: Response) => {
    // const url = new URL(req.originalUrl, 'https://example.com');
    // Headers - NB it seems that in Lambda multiValueHeaders always contains the values from headers
    const headers: Record<string, string | undefined> = {};
    const multiValueHeaders: Record<string, string[] | undefined> = {};
    Object.keys(req.headers).forEach((header) => {
      if (req.headers[header] === undefined) {
        headers[header] = undefined;
        multiValueHeaders[header] = undefined;
      }
      if (typeof req.headers[header] === 'string') {
        headers[header] = req.headers[header] as string;
        multiValueHeaders[header] = [req.headers[header] as string];
      }
      if (Array.isArray(req.headers[header])) {
        multiValueHeaders[header] = req.headers[header] as string[];
      }
    });

    // Query string - basic translation
    const queryStringParameters: Record<string, string | undefined> = {};
    const multiValueQueryStringParameters: Record<string, string[] | undefined> = {};
    Object.keys(req.query).forEach((parameter) => {
      queryStringParameters[parameter] = undefined;
      if (typeof req.query[parameter] === 'string') queryStringParameters[parameter] = req.query[parameter] as string;
      if (Array.isArray(req.query[parameter])) multiValueQueryStringParameters[parameter] = req.query[parameter] as string[];
    });

    const event: APIGatewayProxyEvent = {
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      headers,
      multiValueHeaders,
      httpMethod: req.method,
      path: req.path,
      queryStringParameters,
      multiValueQueryStringParameters,
      requestContext: {
        httpMethod: req.method,
        path: req.path,
        protocol: req.protocol,
      } as unknown as APIGatewayProxyEvent['requestContext'],
    } as unknown as APIGatewayProxyEvent;

    try {
      // Print out the event that will be sent to the handler
      if (debug) {
        console.log('Event:');
        console.log(event.httpMethod, event.path);
        console.log(JSON.stringify(event, null, 2));
      }

      // Invoke the function handler:
      const result = await handler(event, {} as Context);

      // Print out the response if successful
      if (debug) {
        console.log('Result:');
        console.log(event.httpMethod, event.path, result.statusCode);
        console.log(JSON.stringify(result, null, 2));
      }

      // Headers
      res.status(result.statusCode);
      for (const key of Object.keys(result.multiValueHeaders || [])) {
        res.set(key, result.multiValueHeaders![key].map((value) => `${value}`));
      };

      for (const key of Object.keys(result.headers || [])) {
        res.set(key, `${result.headers![key]}`);
      };

      // Body
      res.send(result.body);

    } catch (e) {
      // Log the error and send a 500 response
      console.log(e);
      console.log((e as Error).stack);
      res.status(500).send(`${e}`);
    };
  });

  app.listen(port, () => {
    console.log(`Lambda handler can be invoked at http://localhost:${port}`);
  });
}
