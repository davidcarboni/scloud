/* eslint-disable no-unused-vars */
import {
  Context, SQSBatchResponse, SQSEvent, SQSRecord,
} from 'aws-lambda';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { sqsHandler } from '../src/handler';

const event: SQSEvent = {
  Records: [],
};
const record: SQSRecord = {
  attributes: {
    ApproximateFirstReceiveTimestamp: '',
    ApproximateReceiveCount: '',
    SenderId: '',
    SentTimestamp: '',
  },
  awsRegion: '',
  body: '',
  eventSource: '',
  eventSourceARN: '',
  md5OfBody: '',
  messageAttributes: { none: { dataType: 'test' } },
  messageId: '',
  receiptHandle: '',
};
const context: Context = {
  awsRequestId: '',
  callbackWaitsForEmptyEventLoop: false,
  functionName: '',
  functionVersion: '',
  getRemainingTimeInMillis: () => 1,
  invokedFunctionArn: '',
  logGroupName: '',
  logStreamName: '',
  memoryLimitInMB: '',
  done: () => { },
  fail: () => { },
  succeed: () => { },
};

describe('sqsHandler', () => {
  beforeEach(() => {
    event.Records = [];
  });

  it('Should process a batch of records', async () => {
    const calls: any[] = [];
    event.Records = [record, record, record];
    await sqsHandler(event, context, async (m: SQSRecord, c?: Context): Promise<void> => {
      calls.push(m.body);
    });
    // Our message processing function should be called 3 times
    expect(calls.length).to.equal(3);
  });

  it('Should handle a message processing failure', async () => {
    event.Records = [record, { ...record, messageId: '1' }, record];
    const result = await sqsHandler(event, context, async (m: SQSRecord, c?: Context): Promise<void> => {
      if (m.messageId) throw new Error('boom!');
    });
    // We should get one failure reported
    expect(result).to.deep.equal({ batchItemFailures: [{ itemIdentifier: '1' }] });
  });
});
