import {
  Context, SQSBatchResponse, SQSEvent, SQSRecord,
} from 'aws-lambda';
import axios from 'axios';
import * as fs from 'fs';
import { sqsLocal } from '@scloud/lambda-local';
import sqsHandler from '@scloud/lambda-queue';
// Provided by the container/environment/file
if (fs.existsSync('COMMIT_HASH')) {
  process.env.COMMIT_HASH = fs.readFileSync('COMMIT_HASH').toString().trim();
}
process.env.COMMIT_HASH = process.env.COMMIT_HASH || 'development';

/**
 * Process the content of an SQS message
 */
export async function processMessage(e: SQSRecord) {
  const slackWebhook = process.env.SLACK_WEBHOOK || '';
  if (slackWebhook) {
    await axios.post(slackWebhook, { text: `${e.body}` });
  } else {
    console.log(`Message would be sent to Slack: ${e.body} (process.env.SLACK_WEBHOOK isn't set)`);
  }
}

/**
 * Lambda handler to process a batch of SQS messages
 */
export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH}`);
  const result = sqsHandler(event, context, processMessage);
  return result;
}

(async () => {
  if (process.argv.includes('--local')) {
    sqsLocal(handler);
  }
})();
