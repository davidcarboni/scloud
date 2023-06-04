// eslint-disable-next-line import/no-extraneous-dependencies
import express, { Request, Response } from 'express';
import {
  Context, SQSBatchResponse, SQSEvent, SQSRecord,
} from 'aws-lambda';
import { handler } from './lambda';

const port = 3000;
const app = express();
app.use(express.text({ type: '*/*' }));

app.post('/*', async (req: Request, res: Response) => {
  const event: SQSEvent = {
    Records: [
      {
        body: req.body,
        awsRegion: '',
        eventSource: '',
        eventSourceARN: '',
        md5OfBody: '',
        messageAttributes: {},
        messageId: '',
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
  const context: Context = {
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

  try {
    // Print out the event that will be sent to the handler
    console.log('Event:');
    console.log(JSON.stringify(event));
    Object.keys(event.Records[0]).forEach((key) => {
      console.log(` - ${key}: ${JSON.stringify(event.Records[0][key as keyof SQSRecord])}`);
    });

    // Invoke the function handler:
    const result = await handler(event, context);

    // Print out the response if successful
    if (result) {
      console.log('Result:');
      Object.keys(result).forEach((key) => {
        console.log(` - ${key}: ${JSON.stringify(result[key as keyof SQSBatchResponse])}`);
      });
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
