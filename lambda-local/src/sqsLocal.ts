import * as http from 'http';
import {
  Context, SQSBatchResponse, SQSEvent, SQSRecord,
} from 'aws-lambda';
import { readBody } from './httpHelpers';

export function sqsLocal(handler: (event: SQSEvent, context: Context) => Promise<SQSBatchResponse>, debug = false) {
  const port = +(process.env.port || '3000');

  http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { Allow: 'POST' });
      res.end('Method Not Allowed');
      return;
    }

    try {
      const body = await readBody(req);
      const event: SQSEvent = { Records: [{ body } as SQSRecord] };

      if (debug) {
        console.log('Event:');
        console.log(JSON.stringify(event, null, 2));
      }

      const result = await handler(event, {} as Context);

      if (debug) {
        console.log('Result:');
        console.log(JSON.stringify(result, null, 2));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      console.log(e);
      console.log((e as Error).stack);
      res.writeHead(500);
      res.end(`${e}`);
    }
  }).listen(port, () => {
    console.log(`Lambda handler can be invoked via POST http://localhost:${port}. The request body will be sent as an SQS message body`);
  });
}
