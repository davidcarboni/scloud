import * as awsLambda from 'aws-lambda';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { listItems } from './dynamodb';

export const dummy = '';

/**
 * Lambda handler.
 * NB this doesn't seem to work as a default export.
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: awsLambda.Context,
): Promise<APIGatewayProxyResult> {
  console.log(`Executing ${context.functionName} version: ${process.env.COMMIT_HASH || 'development'}`);

  await listItems('tableName');
  return {
    statusCode: 200,
    body: 'ok',
  };
}
