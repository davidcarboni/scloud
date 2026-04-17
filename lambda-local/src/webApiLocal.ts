import * as http from 'http';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { buildEvent, readBody, sendResult } from './httpHelpers';

export function webApiLocal(lambdaHandler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>, debug = false) {
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
      const result = await lambdaHandler(event, {} as Context);

      if (debug) {
        console.log('Result:');
        console.log(event.httpMethod, event.path, result.statusCode);
        console.log(JSON.stringify(result.body, null, 2));
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
