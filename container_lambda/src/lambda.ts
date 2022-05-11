import * as awsLambda from 'aws-lambda';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';

/**
 * Post an FYI to Slack and don't throw any errors;
 * @param text The message to send (if the SLACK_WEBHOOK env var is set)
 */
export async function slackMe(message: any | undefined) {
  if (message) {
    const slackWebhook = process.env.SLACK_WEBHOOK;
    const text = `${message}`;
    if (slackWebhook) {
      await axios.post(slackWebhook, { text })
        .catch((err) => { console.error(err); });
    } else {
      console.log(`Slack message: ${text}`);
    }
  }
}

/**
 * Lambda handler.
 * NB this doesn't seem to work as a default export.
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: awsLambda.Context,
): Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH || 'development'}`);

  try {
    if (event.body) {
      console.log(event.body);
    }
    return {
      statusCode: 200,
      body: 'ok',
    };
  } catch (err: any) {
    // FYI and retry
    await slackMe(err);
    throw err;
  }
}
