import * as http from 'http';
import {
  Context, SQSBatchResponse, ScheduledEvent,
} from 'aws-lambda';

const eventTemplate: ScheduledEvent = {
  version: '0',
  id: '0',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: new Date().toISOString(),
  region: 'us-east-1',
  resources: [],
  detail: {},
};

export function scheduledLocal(handler: (event: ScheduledEvent, context: Context) => Promise<SQSBatchResponse>, debug = false) {
  const port = +(process.env.port || '3000');

  http.createServer(async (_req, res) => {
    try {
      const result = await handler(eventTemplate, {} as Context);

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
    console.log(`Scheduled Lambda handler can be invoked at http://localhost:${port}. Any request will trigger the handler with a synthetic ScheduledEvent`);
  });
}
