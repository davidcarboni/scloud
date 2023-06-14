# Lambda SQS handler

A Lambda handler that processes SQS messages and returns any batch item failures for retry.

This is a piece of useful boilerplate to handle the mechanics of processing a batch of messages, catching any errors and retrying failed messages.

See: https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html#services-sqs-batchfailurereporting

## Usage

Create your message processing function:

```
/**
 * Process a single SQS message.
 * It's safe to allow exceptions to be thrown.
 * Errors will be caught and handled as a batch item failure.
 */
export async function messageHandler(message: SQSRecord) {
  const slackWebhook = process.env.SLACK_WEBHOOK || '';
  if (slackWebhook) {
    await axios.post(slackWebhook, { text: `${message.body}` });
  } else {
    console.log(`Message would be sent to Slack: ${message.body} (process.env.SLACK_WEBHOOK isn't set)`);
  }
}
```

Call `@scloud/lambda-queue` from your Lambda handler:

```
import sqsHandler from '@scloud/lambda-queue'

export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  const result = await sqsHandler(messageHandler, event, context)
  return result;
}
```

The `sqsHandler` function will call your message handler for each item in the batch, catching any errors and returning an `SQSBatchResponse` with any failed message IDs so that Lambda can retry.
