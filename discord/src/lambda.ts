import {
  Context, SQSBatchResponse, SQSEvent,
} from 'aws-lambda';
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
  try {
    const message = JSON.parse(body);
    const discordWebhook = message.channel === 'general' ? process.env.DISCORD_EVENTS || '' : process.env.DISCORD_LOG || '';
    if (discordWebhook) {
      if (message.content) await fetch(discordWebhook, { method: 'POST', body: JSON.stringify({ content: message.content }), headers: { 'Content-Type': 'application/json' } });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // Deprecated message format - plain text message
    const discordWebhook = process.env.DISCORD_WEBHOOK || '';
    if (discordWebhook) {
      if (body) await fetch(discordWebhook, { method: 'POST', body: JSON.stringify({ content: body }), headers: { 'Content-Type': 'application/json' } });
    }
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

  // Report on any failed items for retry
  const result: SQSBatchResponse = {
    batchItemFailures: failedIds.map((id) => ({ itemIdentifier: id })),
  };
  return result;
}
