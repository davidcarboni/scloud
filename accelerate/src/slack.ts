import * as AWS from 'aws-sdk';
import env from './bumph';

const product = 'project'
const component = 'accelerate';

function identifier() {
  // Collect as much information as we have available about this component
  const segments: (string|undefined)[] = [product, component, process.env.DEPLOYMENT, process.env.COMMIT_HASH];
  return segments.filter((segment) => segment).join('/');
}

function queueUrl(): string {
  const url = process.env.SLACK_QUEUE_URL || '';
  if (!url) console.warn('Please set SLACK_QUEUE_URL if you would like to receive Slack notificaitons.');
  return url;
}

/**
 * Post an FYI to Slack and don't throw any errors;
 * @param message The message to send (if the SLACK_QUEUE_URL env var is set)
 */
export default async function slackMessage(message: string) {
  if (message) {
    const url = queueUrl();
    if (url) {
      try {
        await new AWS.SQS().sendMessage({
          MessageBody: `[${identifier()}] ${message}`,
          QueueUrl: url,
        }).promise();
      } catch (err) { console.error(err); }
    } else {
      console.log(`Slack message would be sent: ${message}`);
    }
  }
}
