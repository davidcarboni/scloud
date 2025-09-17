import express, { Request, Response } from 'express';
import {
  Context, SQSBatchResponse, SQSEvent, SQSRecord,
} from 'aws-lambda';

export function sqsLocal(handler: (event: SQSEvent, context: Context) => Promise<SQSBatchResponse>) {
  const port = +(process.env.port || '3000');
  const app = express();

  // https://stackoverflow.com/questions/12345166/how-to-force-parse-request-body-as-plain-text-instead-of-json-in-express
  app.use(express.text({ type: '*/*' }));

  app.post('/*', async (req: Request, res: Response) => {
    try {
      // Print out the event that will be sent to the handler
      const event: SQSEvent = { Records: [{ body: req.body } as SQSRecord] };
      console.log('Event:');
      console.log(JSON.stringify(event, null, 2));

      // Invoke the function handler:
      const result = await handler(event, {} as Context);

      console.log('Result:');
      console.log(JSON.stringify(result, null, 2));

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
    console.log(`Lambda handler can be invoked via POST http://localhost:${port}. The request body will be sent as an SQS message body`);
  });
}
