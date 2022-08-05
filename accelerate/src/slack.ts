import * as AWS from 'aws-sdk';

const component = 'scloud/accelerate';

/**
 * Post an FYI to Slack and don't throw any errors;
 * @param message The message to send (if the SLACK_QUEUE_URL env var is set)
 */
export default async function slackMessage(message: string) {
  if (message) {
    const queueUrl = process.env.SLACK_QUEUE_URL || '';
    if (queueUrl) {
      try {
        await new AWS.SQS().sendMessage({
          MessageBody: `[${component}] ${message}`,
          QueueUrl: queueUrl,
        }).promise();
      } catch (err) { console.error(err); }
    } else {
      console.log(`Slack message would be sent: ${message}`);
    }
  }
}
