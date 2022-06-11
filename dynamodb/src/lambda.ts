import * as awsLambda from 'aws-lambda';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DocumentClient, ScanInput } from 'aws-sdk/clients/dynamodb';

/**
 * https://stackoverflow.com/questions/44589967/how-to-fetch-scan-all-items-from-aws-dynamodb-using-node-js
 */
export async function listTable(): Promise<any[]> {
  const params: ScanInput = {
    TableName: 'tableName',
  };

  const documentClient: DocumentClient = new DocumentClient();
  const scanResults: any[] = [];
  let items;
  do {
    // eslint-disable-next-line no-await-in-loop
    items = await documentClient.scan(params).promise();
    items.Items?.forEach((item) => scanResults.push(item));
    params.ExclusiveStartKey = items.LastEvaluatedKey;
  } while (typeof items.LastEvaluatedKey !== 'undefined');

  return scanResults;
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

  listTable();
  return {
    statusCode: 200,
    body: 'ok',
  };
}
