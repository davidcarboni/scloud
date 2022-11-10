import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as crypto from 'crypto';
import slackMessage from './slack';

// The version of the code we're running
if (fs.existsSync('COMMIT_HASH')) {
  process.env.COMMIT_HASH = fs.readFileSync('COMMIT_HASH').toString().trim();
}
process.env.COMMIT_HASH = process.env.COMMIT_HASH || 'development';

/**
 * A DynamoDB table item representing a metric
 */
export type Metric = {
  metric: string; // github.build
  date: string; // build completed date
} & {[key: string]: any};

async function sendMetric(metric: Metric): Promise<void> {
  const queueUrl = process.env.METRICS_QUEUE_URL;
  if (!queueUrl) {
    await slackMessage(`Metric would be sent: ${JSON.stringify(metric)} (METRICS_QUEUE_URL isn't set)`);
  } else {
    try {
      await new AWS.SQS().sendMessage({
        MessageBody: JSON.stringify(metric),
        QueueUrl: queueUrl,
      }).promise();
    } catch (err) {
      await slackMessage(`${err}`);
    }
  }
  return undefined;
}

async function sendBuildMetric(webhook: any): Promise<void> {
  const { action } = webhook;
  const created = webhook.workflow_run?.created_at;
  const updated = webhook.workflow_run?.updated_at;
  const repository = webhook.repository?.name;
  const branch = webhook.workflow_run?.head_branch;
  const workflow = webhook.workflow?.path;
  const user = webhook.sender?.login;
  const status = webhook.workflow_run?.status;
  const conclusion = webhook.workflow_run?.conclusion;
  const commitHash = webhook.workflow_run?.head_sha;
  const url = webhook.workflow_run?.html_url;
  await slackMessage(`${action}: ${repository}[${branch}]/${workflow}`);

  // Workflow events we don't want to report on:
  if (action !== 'completed' || status !== 'completed' || conclusion !== 'success') {
    return undefined;
  }

  // Cycle time
  let cycleTime;
  if (created && updated) {
    // Start/end in seconds
    const start = Math.floor(new Date(created).getTime() / 1000);
    const end = Math.floor(new Date(updated).getTime() / 1000);
    cycleTime = end - start;
  }

  const metric: Metric = {
    metric: 'github.build', // PK
    date: created, // SK
    repository, // SK
    branch, // SK
    workflow, // SK
    url,
    created,
    updated,
    user,
    status,
    conclusion,
    cycleTime,
    commitHash,
  };
  await sendMetric(metric);
  return undefined;
}

async function sendIssueMetric(webhook: any): Promise<void> {
  const { action } = webhook;
  const created = webhook.issue?.created_at;
  const updated = webhook.issue?.updated_at;
  const repository = webhook.repository?.name;
  const title = webhook.issue?.title;
  const user = webhook.sender?.login;
  const state = webhook.issue?.state;
  const closed = webhook.issue?.closed_at;
  const labels: string[] = webhook.issue?.labels.map((label:any) => label.name);
  const url = webhook.issue?.url;
  await slackMessage(`${action}: ${repository}/${title}[${labels}]/${state}`);

  const metric: Metric = {
    metric: 'github.issue', // PK
    date: created, // SK
    url, // SK
    created,
    updated,
    action,
    repository,
    title,
    user,
    state,
    closed,
    labels,
  };
  await sendMetric(metric);
  return undefined;
}

/**
 * Lambda handler.
 */
export async function handler(event: APIGatewayProxyEvent, context: Context):
  Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH}`);

  try {
    // Webhooks POSTed from Github
    if (event.httpMethod === 'POST' && event.headers['X-Hub-Signature-256']) {
      const signature = event.headers['X-Hub-Signature-256'];
      const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET || '');
      hmac.update(event.body || '');
      const digest = `sha256=${hmac.digest('hex')}`;
      if (signature === digest) {
        const message = JSON.parse(event.body || '');
        const githubEvent = event.headers['X-GitHub-Event'];
        if (githubEvent === 'workflow_run') await sendBuildMetric(message);
        else if (githubEvent === 'issues') await sendIssueMetric(message);
        else await slackMessage(`Unhandled github webhook event: ${githubEvent}\n${JSON.stringify(message)}`);
      } else {
        await slackMessage(`[${signature === digest}] From Github: ${signature} | Computed: ${digest}`);
      }
    } else {
      console.log(`Invalid Github webhook request: ${event.httpMethod} headers: ${JSON.stringify(event.headers)}`);
    }
  } catch (err: any) {
    // FYI but respond ok to Github:
    await slackMessage(`Github webhook error: ${err} [${event.httpMethod} ${event.path}] : ${event.body}`);
  }

  // Always respond ok to Github
  return {
    statusCode: 200,
    body: 'ok',
  };
}
