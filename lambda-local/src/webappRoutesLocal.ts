import express, { Request, Response } from 'express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export interface CloudfrontPathMappings {
  [key: string]: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
}

export function webappRoutesLocal(cloudfrontPathMappings: CloudfrontPathMappings, staticContent?: string, debug = false) {
  const port = +(process.env.port || '3000');
  const app = express();

  // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
  app.use(express.text({ type: '*/*' }));

  Object.keys(cloudfrontPathMappings).forEach((route) => {
    app.all(route, async (req: Request, res: Response) => {
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

        const paths = Object.keys(cloudfrontPathMappings);

        // Use the handler for this Express route
        const handler = cloudfrontPathMappings[route];
        if (!handler) console.log(`Unmatched path: ${event.path}`);

        // Invoke the function handler:
        const result = handler ? await handler(event, {} as Context) : { statusCode: 404, body: `Path not matched: ${event.path} (${paths})` };

        // Print out the response if successful
        if (debug) {
          console.log('Result:');
          console.log(event.httpMethod, event.path, result.statusCode);
          console.log(JSON.stringify(result, null, 2));
        }

        // Send the response
        res.status(result.statusCode);
        if (result.multiValueHeaders) {
          Object.keys(result.multiValueHeaders).forEach((key) => {
            res.set(key, result.multiValueHeaders![key].map((value) => `${value}`));
          });
        }
        if (result.headers) {
          Object.keys(result.headers).forEach((key) => {
            res.set(key, `${result.headers![key]}`);
          });
        }

        // Body
        res.send(result.body);

      } catch (e) {
        // Log the error and send a 500 response
        console.log(e);
        console.log((e as Error).stack);
        res.status(500).send(`${e}`);
      }
    });
  });

  if (staticContent) app.use(express.static(staticContent));

  app.listen(port, () => {
    console.log(`Lambda handler can be invoked at http://localhost:${port}`);
  });
}
