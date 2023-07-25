// eslint-disable-next-line import/no-extraneous-dependencies
import express, { Request, Response } from 'express';
import {
  Context, SQSBatchResponse, SQSEvent, SQSRecord,
} from 'aws-lambda';

const eventTemplate: SQSEvent = {
  Records: [
    {
      body: '',
      awsRegion: '',
      eventSource: '',
      eventSourceARN: '',
      md5OfBody: '',
      messageAttributes: {},
      messageId: '1',
      receiptHandle: '',
      attributes: {
        ApproximateFirstReceiveTimestamp: '',
        ApproximateReceiveCount: '',
        SenderId: '',
        SentTimestamp: '',
      },
    },
  ],
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
export function sqsLocal(handler: (event: SQSEvent, context: Context) => Promise<SQSBatchResponse>) {
  const port = +(process.env.port || '3000');
  const app = express();

  // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
  app.use(express.text({ type: '*/*' }));

  app.post('/*', async (req: Request, res: Response) => {
    try {
      // Print out the event that will be sent to the handler
      console.log('Event:');
      const event = { ...eventTemplate, body: req.body };
      console.log(JSON.stringify(event));
      Object.keys(event.Records[0]).forEach((key) => {
        console.log(` - ${key}: ${JSON.stringify(event.Records[0][key as keyof SQSRecord])}`);
      });

      // Invoke the function handler:
      const result = await handler(event, contextTemplate);

      // Print out the response if successful
      if (result) {
        if (result.statusCode === 404) {
          console.log(`404: ${event.path}`);
        } else {
          console.log('Result:');
          Object.keys(result).forEach((key) => {
            console.log(` - ${key}: ${JSON.stringify(result[key as keyof APIGatewayProxyResult]).slice(0, 100)}`);
          });
        }
      }

      // Send the response
      res.status(200).send(JSON.stringify(result.batchItemFailures));
    } catch (e) {
      // Log the error and send a 500 response
      console.log(e);
      console.log((e as Error).stack);
      res.status(500).send(`${e}`);
    }
  });

  app.listen(port, () => {
    console.log(`Lambda handler can be invoked via POST http://localhost:${port}. The request body will be sent as an SQS message body`);
  });
}
