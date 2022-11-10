import {
  Context, SQSBatchResponse, SQSEvent,
} from 'aws-lambda';
import * as fs from 'fs';
import { putItem } from './dynamodb';
import slackMessage from './slack';
import { env, id } from './bumph';

// The version of the code we're running
if (fs.existsSync('COMMIT_HASH')) {
  process.env.COMMIT_HASH = fs.readFileSync('COMMIT_HASH').toString().trim();
}
process.env.COMMIT_HASH = process.env.COMMIT_HASH || 'development';

/**
 * A DynamoDB table item.
 */
export type Item = {
  metric: string; // DynamoDB partition key
  dateSort: string; // DynamoDB sort key - date, plus some random characters to make a unique ID
  date?: string; // Date sent (or defaults to date received)
  test?: boolean; // False if this is a production metric we want to keep/report on
  commitHash?: string; // Commit hash of the version of the code that sent the metric
  ttl?: number; // DynamoDB Time to Live (TTL)
} & { [key: string]: any; };

/**
 * An item with fields used in a Github build metric.
 */
export type GithubItem = Item & {
  repository?: string, // Repo name
  workflow?: string, // Workflow filename and path
  branch?: string, // Branch that triggered the workflow
  user?: string, // User who triggered the workflow
  status?: string, // Workflow status (expect 'completed')
  conclusion?: string, // Workflow conclusion (expect 'success')
  cycleTime?: Number, // Seconds between workflow run creation and last updated time
};

/**
 * Processes an incoming record body to build an item that can be stored in the table.
 * @param body The body attribute of an SQSRecord
 */
export function buildItem(body: string): { [key: string]: any; } | undefined {
  // Parse the metric
  let item: Item;
  try {
    item = JSON.parse(body);
  } catch (err) {
    return undefined;
  }

  // Ensure we have a metric name - fallback to 'default'
  const metric = env('PARTITION_KEY'); // 'metric'
  item[metric] = item[metric] || 'unknown';

  // Ensure we have a date in ISO format - fallback to now
  let date;
  try {
    date = new Date(item.date || Date.now());
  } catch (err) {
    // Possibly an unparseable date
    date = new Date();
  }
  item.date = date.toISOString();

  // Generate a sort key dased on the date
  let unique: string;
  if (item.metric === 'github.build') {
    unique = `${item.repository}[${item.branch}]/${item.workflow}`;
  } else if (item.metric === 'github.issue') {
    unique = `${item.url}`;
  } else if (item.metric.slice(0, 5) === 'user.') {
    unique = `${item.metric}:${item.id}:${item.email}`;
  } else if (item.metric.slice(0, 4) === 'web.') {
    unique = `${item.metric}:${item.method}:${item.path}`;
  } else {
    // Have a guess at possible IDs
    unique = item.url || item.id || id();
  }
  item[env('SORT_KEY')] = `${item.date}#${unique}`;

  // ttl - default to two years from now
  const ttl = env('TTL_ATTRIBUTE'); // ttl
  const nowSeconds = Math.floor(Date.now() / 1000.0);
  const twoYearsSeconds = 60 * 60 * 24 * 365 * 2;
  item[ttl] = Number(item[ttl]) || nowSeconds + twoYearsSeconds;

  // Record the version of the code that created this metric
  item.commitHash = process.env.COMMIT_HASH;

  return item;
}

/**
 * Process the content of an SQS message
 */
export async function processMessage(body: string) {
  const item = buildItem(body);
  if (item) {
    const tableName = env('STORAGE_TABLE') || 'metrics';
    await putItem(tableName, item);
    if (item.metric !== 'web.bot') await slackMessage(`${item.metric}: ${JSON.stringify(item)}`);
  } else {
    await slackMessage(`Invalid metric message: ${body}`);
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
    batchItemFailures: failedIds.map((failedId) => ({ itemIdentifier: failedId })),
  };
  return result;
}
