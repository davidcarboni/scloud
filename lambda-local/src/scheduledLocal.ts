// eslint-disable-next-line import/no-extraneous-dependencies
import express, { Request, Response } from 'express';
import {
  Context, SQSBatchResponse, ScheduledEvent,
} from 'aws-lambda';

const eventTemplate: ScheduledEvent = {
  version: '0',
  id: '0',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: '1970-01-01T00:00:00Z',
  region: 'us-east-1',
  resources: [],
  detail: {},
};

const contextTemplate: Context = {
  awsRequestId: '',
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test',
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
export function scheduledLocal(handler: (event: ScheduledEvent, context: Context) => Promise<SQSBatchResponse>) {
  const port = +(process.env.port || '3000');
  const app = express();

  app.all('/*', async (req: Request, res: Response) => {
    try {
      // Invoke the function handler:
      const result = await handler(eventTemplate, contextTemplate);

      if (result) {
        console.log('Result:');
        console.log(JSON.stringify(result));
      }

      // Send the response
      res.status(200).send(JSON.stringify(result));
    } catch (e) {
      // Log the error and send a 500 response
      console.log(e);
      console.log((e as Error).stack);
      res.status(500).send(`${e}`);
    }
  });

  app.listen(port, () => {
    console.log(`Scheduled Lambda handler can be invoked via POST http://localhost:${port}. The request body will be sent as an SQS message body`);
  });
}
