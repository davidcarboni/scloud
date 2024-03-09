/* eslint-disable import/prefer-default-export */
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { apiHandler } from '@scloud/lambda-api';
import { webappLocal } from '@scloud/lambda-local';
import routes from './routes';
import slackLog from './helpers/slack';

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName}`);

  try {
    // Handle request
    const result = await apiHandler(event, context, routes);
    return result;
  } catch (e) {
    // Handle error
    await slackLog(`${(e as Error).stack}`);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
}

(async () => {
  if (process.argv.includes('--local')) {
    webappLocal(handler);
  }
})();
