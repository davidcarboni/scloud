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

export interface APIGatewayResponse {
  statusCode: number,
  headers?: { [key: string]: string; },
  body: string;
  isBase64Encoded?: boolean,
}

async function sendMetric(webhook: any, githubEvent: string): Promise<any> {
  // TEMP: so we can see the different event names sent by github
  await slackMessage(`Github webhook received for ${githubEvent}`);

  if (githubEvent === 'workflow_run') {
    const repository = webhook.repository?.name;
    const branch = webhook.workflow_run?.head_branch;
    const workflow = webhook.workflow?.path;
    const user = webhook.sender?.login;
    const { action } = webhook;
    const status = webhook.workflow_run?.status;
    const conclusion = webhook.workflow_run?.conclusion;
    const created = webhook.workflow_run?.created_at;
    const updated = webhook.workflow_run?.updated_at;
    const commitHash = webhook.workflow_run?.head_sha;
    const url = webhook.workflow_run?.html_url;
    await slackMessage(`${action}: ${repository}[${branch}]/${workflow}`);

    // await slackMe(`${action}: ${workflowName} ${repository}[${branch}]/${workflowPath}
    // status:${status} conclusion:${conclusion}`);

    // Workflow events we don't want to report on:
    if (action !== 'completed') {
      await slackMessage(`${action}: ${repository}[${branch}] ${workflow}`);
      return undefined;
    }
    if (status !== 'completed') {
      await slackMessage(`${status}: ${repository}[${branch}] ${workflow}`);
      return undefined;
    }
    if (conclusion !== 'success') {
      await slackMessage(`${conclusion}: ${repository}[${branch}] ${workflow}`);
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

    const metric = {
      metric: 'github.build',
      date: updated || created || new Date().toISOString(),
      repository,
      workflow,
      branch,
      user,
      status,
      conclusion,
      cycleTime,
      commitHash,
      url,
    };

    const queueUrl = process.env.METRICS_QUEUE_URL || '';
    if (!queueUrl) {
      console.log(JSON.stringify(metric));
      return undefined;
    }
    await slackMessage(JSON.stringify(metric));
    return new SQS().sendMessage({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(metric),
    }).promise();
  } else {
    await slackMessage(`Unhandled github webhook event: ${githubEvent}`)
  }
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
        await sendMetric(message, event.headers['X-GitHub-Event'] || 'unknown');
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
