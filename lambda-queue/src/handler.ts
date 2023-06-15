/* eslint-disable import/prefer-default-export */
/* eslint-disable no-unused-vars */
import {
  Context, SQSBatchResponse, SQSEvent, SQSRecord,
} from 'aws-lambda';

/**
 * Lambda handler to process a batch of SQS messages
 */
export async function sqsHandler(
  event: SQSEvent,
  context: Context,
  processMessage: (m: SQSRecord, c?: Context) => Promise<void>,
): Promise<SQSBatchResponse> {
  // Process incoming message(s) and note any failures
  const failedIds: string[] = [];
  const records = event.Records.map(async (record) => {
    try {
      await processMessage(record, context);
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
