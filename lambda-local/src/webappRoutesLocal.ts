/* eslint-disable no-unused-vars */
// eslint-disable-next-line import/no-extraneous-dependencies
import express, { Request, Response } from 'express';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { request } from 'http';

export interface CloudfrontPathMappings {
  [key: string]: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
}

const eventTemplate: APIGatewayProxyEvent = {
  body: '',
  headers: {},
  multiValueHeaders: {},
  httpMethod: '',
  isBase64Encoded: false,
  path: '',
  pathParameters: null,
  queryStringParameters: {},
  multiValueQueryStringParameters: {},
  stageVariables: null,
  resource: '?',
  requestContext: {
    accountId: '',
    apiId: '',
    authorizer: null,
    httpMethod: '',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '',
      user: null,
      userAgent: null,
      userArn: null,
    },
    path: '',
    protocol: '',
    requestId: '',
    requestTimeEpoch: 0,
    resourceId: '',
    resourcePath: '',
    stage: '',
  },
};
const contextTemplate: Context = {
  awsRequestId: '',
  callbackWaitsForEmptyEventLoop: false,
  functionName: '',
  functionVersion: '',
  invokedFunctionArn: '',
  logGroupName: '',
  logStreamName: '',
  memoryLimitInMB: '',
  getRemainingTimeInMillis: () => 0,
  done: () => { },
  fail: () => { },
  succeed: () => { },
};

// eslint-disable-next-line no-unused-vars
export function webappRoutesLocal(cloudfrontPathMappings: CloudfrontPathMappings, staticContent?: string) {
  const port = +(process.env.port || '3000');
  const app = express();

  // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
  app.use(express.text({ type: '*/*' }));

  Object.keys(cloudfrontPathMappings).forEach((route) => {
    app.all('route', async (req: Request, res: Response) => {
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

      const event = {
        ...eventTemplate,
        body: req.body,
        headers,
        multiValueHeaders,
        httpMethod: req.method,
        path: req.path,
        queryStringParameters,
        multiValueQueryStringParameters,
        requestContext: {
          ...eventTemplate.requestContext,
          httpMethod: req.method,
          path: req.path,
          protocol: req.protocol,
        },
      };

      try {
        // Print out the event that will be sent to the handler
        console.log('Event:');
        Object.keys(event).forEach((key) => {
          console.log(` - ${key}: ${JSON.stringify(event[key as keyof APIGatewayProxyEvent])}`);
        });

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
        if (!handler) console.log(`Unmatched path: ${event.path}`);

        // Invoke the function handler:
        const result: APIGatewayProxyResult = handler ? await handler(event, contextTemplate) : { statusCode: 404, body: `Path not matched: ${event.path} (${paths})` };

        // Print out the response if successful
        if (result) {
          console.log('Result:');
          Object.keys(result).forEach((key) => {
            console.log(` - ${key}: ${JSON.stringify(result[key as keyof APIGatewayProxyResult])}`);
          });
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
