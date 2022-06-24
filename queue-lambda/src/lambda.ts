import * as util from 'util';
import * as awsLambda from 'aws-lambda';
import { SQSBatchItemFailure } from 'aws-lambda';
// import * as request from 'request-promise';
import axios from 'axios';

interface Webhook {
  uri: string,
  headers: { [key: string]: string; },
  body: { [key: string]: any; },
  json: boolean,
}
// Any failed messages for retry
const batchItemFailures: SQSBatchItemFailure[] = [];

export function env(name: string) {
  const result = process.env[name] || '';
  if (!result) console.error(`Env var ${name} is required.`);
  return result;
}

const slackWebhook = env('SLACK_WEBHOOK');

/**
 * @param message An object to be formatted for the logs.
 * @returns A single-line util.inspect formatted string of the object.
 */
export function format(message: any) {
  return util.inspect(message, { depth: 5 }).replace(/\r?\n/g, '');
}

/**
 * Post an FYI to Slack and don't throw any errors;
 * @param text The message to send
 */
export async function slackMe(message: any | undefined) {
  if (message) {
    const text = `${message}`;
    if (slackWebhook) {
      await axios.post(slackWebhook, { text })
        .catch((err) => { console.error(err); });
    } else {
      console.log(`Slack message: ${text}`);
    }
  }
}

function validate(webhook: Webhook): boolean {
  if (webhook
    && webhook.uri
    && webhook.body) {
    return true;
  }
  return false;
}

/**
 * Process a webhook message.
 * @param record An SQS message
 */
async function processRecord(record: awsLambda.SQSRecord) {
  const message = JSON.parse(record.body) as Webhook;

  if (validate(message)) {
    throw new Error('Throwing an error every time to test retry');
    // request.post(message); TODO: Actually post the message
    // await slackMe(`Processed webhook message: ${JSON.stringify(message)}`);
  } else {
    await slackMe(`Invalid webhook message received: ${JSON.stringify(record.body)}, discarding`);
  }
}

/**
   * Lambda handler.
   */
export async function handler(event: awsLambda.SQSEvent, context: awsLambda.Context) {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH || 'development'}`);

  try {
    // Process each incoming metric message
    const records = event.Records.map(async (record) => {
      try {
        await processRecord(record);
      } catch (err) {
        batchItemFailures.push({ itemIdentifier: record.messageId });
        await slackMe(`Error processing webhook message: ${JSON.stringify(record.body)}: ${err}`);
      }
    });
    await Promise.all(records);

    const result = { batchItemFailures };
    // Return any item failures for retry
    await slackMe(`Returning: ${JSON.stringify(result)} as result of lambda`);
    return result;
  } catch (err: any) {
    // FYI and retry
    console.log(`Error processing webhook message: ${err}`);
    slackMe(err);
    slackMe(err.stack);
    throw err;
  }
}
