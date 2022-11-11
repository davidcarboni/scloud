import {
  Context, SQSBatchResponse, SQSEvent,
} from 'aws-lambda';
import axios from 'axios';
import * as fs from 'fs';

// Provided by the container/environment/file
if (fs.existsSync('COMMIT_HASH')) {
  process.env.COMMIT_HASH = fs.readFileSync('COMMIT_HASH').toString().trim();
}
process.env.COMMIT_HASH = process.env.COMMIT_HASH || 'development';

/**
 * Process the content of an SQS message
 */
export async function processMessage(body: string) {
  const slackWebhook = process.env.SLACK_WEBHOOK || '';
  if (slackWebhook) {
    await axios.post(slackWebhook, { text: `${body}` });
  }
}

/**
 * Lambda handler to process a batch of SQS messages
 */
export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH}`);

  // Process incoming message(s)
  // and note any failures
  const failedIds: string[] = [];
  const records = event.Records.map(async (record) => {
    try {
      await processMessage(record.body);
    } catch (err) {
      failedIds.push(record.messageId);
      console.error(`Message error: ${err} [${record.messageId}]`);
    }
  });
  await Promise.all(records);

  // Report on any failred items for retry
  const result: SQSBatchResponse = {
    batchItemFailures: failedIds.map((id) => ({ itemIdentifier: id })),
  };
  return result;
}
