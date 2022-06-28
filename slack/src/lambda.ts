import {
  Context, SQSBatchResponse, SQSEvent, SQSRecord,
} from 'aws-lambda';
import axios from 'axios';
import * as fs from 'fs';

const slackWebhook = process.env.SLACK_WEBHOOK || '';

// Provided by the container/environment/file
let commitHash = process.env.COMMIT_HASH || 'development';
if (fs.existsSync('COMMIT_HASH')) {
  commitHash = fs.readFileSync('COMMIT_HASH').toString();
}

// Any failed messages for retry
const failedMessageIds: string[] = [];

export async function processMessage(body: string) {
  if (slackWebhook) {
    await axios.post(slackWebhook, { text: `${body}` });
  } else {
    console.log(`Slack message (mot sent): ${body}`);
  }
}

/**
 * Process an SQS messagee
 * @param record A received message.
 */
export async function processRecord(record: SQSRecord) {
  try {
    processMessage(record.body);
  } catch (err) {
    // Note this item for retry
    failedMessageIds.push(record.messageId);
    console.log(`Message error: ${err} [${record.messageId}]`);
  }
}

/**
 * Lambda handler.
 */
export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  try {
    console.log(`Executing ${context.functionName} version: ${commitHash}`);

    // Process incoming message(s)
    const promises = event.Records.map((record) => processRecord(record));
    await Promise.all(promises);

    // Return any item failures for retry
    return {
      batchItemFailures: failedMessageIds.map((messageId) => ({ itemIdentifier: messageId }))
    };
  } catch (err) {
    // Report the error to Lambda for retry
    console.log(`Slack messaging error: ${err}`);
    throw err;
  }
}
