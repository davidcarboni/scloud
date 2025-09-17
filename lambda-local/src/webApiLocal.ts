import express, { Request, Response } from 'express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export function webApiLocal(lambdaHandler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>) {
  const port = +(process.env.port || '3000');
  const app = express();

  // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
  app.use(express.text({ type: '*/*' }));

  app.use(async (req: Request, res: Response) => {
    // const url = new URL(req.originalUrl, 'https://example.com');
    // Headers - NB it seems that in Lambda multiValueHeaders always contains the values from headers
    const headers: Record<string, string | undefined> = {};
    const multiValueHeaders: Record<string, string[] | undefined> = {};
    Object.keys(req.headers).forEach((header) => {
      if (req.headers[header] === undefined) {
        headers[header] = undefined;
        multiValueHeaders[header] = undefined;
      } else if (typeof req.headers[header] === 'string') {
        headers[header] = req.headers[header];
        multiValueHeaders[header] = (multiValueHeaders[header] || []).concat([req.headers[header]]);
      } else if (Array.isArray(req.headers[header])) {
        multiValueHeaders[header] = (multiValueHeaders[header] || []).concat(req.headers[header]);
      }
    });

    // Query string - basic translation
    const queryStringParameters: Record<string, string | undefined> = {};
    const multiValueQueryStringParameters: Record<string, string[] | undefined> = {};
    for (const name of Object.keys(req.query)) {
      const value = req.query[name];
      if (typeof value === 'string') queryStringParameters[name] = value;
    }

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
      console.log('Event:');
      for (const key of Object.keys(event)) {
        console.log(` - ${key}: ${JSON.stringify(event[key as keyof APIGatewayProxyEvent])}`);
      }

      // Invoke the function handler:
      const result = await lambdaHandler(event, {} as Context);

      // Print out the result
      console.log(event.httpMethod, event.path, result.statusCode);
      if (result) {
        console.log('Result:');
        console.log(JSON.stringify(result.body, null, 2));
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
    }
  });

  app.listen(port, () => {
    console.log(`Lambda handler can be invoked at http://localhost:${port}`);
  });
}
