import { config } from 'aws-sdk';
import { DocumentClient, ScanInput } from 'aws-sdk/clients/dynamodb';

config.update({ region: 'eu-west-2' });
const ddb = new DocumentClient();

export interface Key {
  name: string,
  value: any,
}

export interface Range {
  name: string,
  from: any,
  to: any,
}

/**
 * Get an item
 * @param tableName DynamoDB table name
 * @param key 1-2 fields: partition key (requierd) and, optionally, sort key
 * @returns The item, if found, or {}
 */
export async function getItem(tableName: string, key: { [key: string]: any; })
  : Promise<{ [key: string]: any; }> {
  const result = await ddb.get({
    TableName: tableName,
    Key: key,
  }).promise();
  return result.Item ? result.Item : {};
}

/**
 * Get an item
 * @param tableName DynamoDB table name
 * @param indexName Index name
 * @param id The item ID (partition key)
 * @returns The item, if found, or {}
 */
export async function getIndex(tableName: string, indexName: string, id: any)
  : Promise<{ [key: string]: any; }> {
  const result = await ddb.query({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: `${indexName} = :id`,
    ExpressionAttributeValues: {
      ':id': id,
    },
  }).promise();
  return result.Items && result.Items[0] ? result.Items[0] : {};
}

/**
 * Put an item
 * @param tableName DynamoDB table name
 * @param item Must include the partition key and, if defined, the sort key
 */
export async function putItem(tableName: string, item: { [key: string]: any; }) {
  await ddb.put({
    TableName: tableName,
    Item: item,
  }).promise();
}

/**
 * https://stackoverflow.com/questions/44589967/how-to-fetch-scan-all-items-from-aws-dynamodb-using-node-js
 * @param tableName DynamoDB table name
 * @returns All the items that match the partition key and begin with the sort key
 */
export async function findItems(tableName: string, partitionKey: Key, sortKey: Key)
  : Promise<{ [key: string]: any; }[]> {
  const params: any = {
    TableName: tableName,
    KeyConditionExpression: `${partitionKey.name} = :pk AND begins_with ( ${sortKey.name}, :sk )`,
    ExpressionAttributeValues: {
      ':pk': partitionKey.value,
      ':sk': sortKey.value,
    },
  };

  const result: any[] = [];
  let items;
  do {
    // eslint-disable-next-line no-await-in-loop
    items = await ddb.query(params).promise();
    if (items.Items) items.Items.forEach((item) => result.push(item));
    params.ExclusiveStartKey = items.LastEvaluatedKey;
  } while (typeof items.LastEvaluatedKey !== 'undefined');

  return result;
}

/**
 * Selects a range of items between two sort keys
 * @param tableName DynamoDB table name
 * @param partitionKey The partition key to select
 * @param sortKey The starting/ending sort key values
 * @returns An array of items in the given sort key range
 */
export async function findItemRange(
  tableName: string,
  partitionKey: Key,
  sortKey: Range,
  attributes?: string[],
): Promise<{ [key: string]: any; }[]> {
  const params: any = {
    TableName: tableName,
    KeyConditionExpression: `${partitionKey.name} = :pk AND ${sortKey.name} BETWEEN :from AND :to`,
    ExpressionAttributeValues: {
      ':pk': partitionKey.value,
      ':from': sortKey.from,
      ':to': sortKey.to,
    },
  };
  if (attributes) params.ProjectionExpression = attributes.join(',');

  const result: any[] = [];
  let items;
  do {
    // eslint-disable-next-line no-await-in-loop
    items = await ddb.query(params).promise();
    if (items.Items) items.Items.forEach((item) => result.push(item));
    params.ExclusiveStartKey = items.LastEvaluatedKey;
  } while (typeof items.LastEvaluatedKey !== 'undefined');

  return result;
}

/**
 * https://stackoverflow.com/questions/44589967/how-to-fetch-scan-all-items-from-aws-dynamodb-using-node-js
 * @param tableName DynamoDB table name
 * @returns An array containing all the items (could get large!)
 */
export async function listItems(tableName: string): Promise<any[]> {
  const params: ScanInput = {
    TableName: tableName,
  };

  const result: any[] = [];
  let items;
  do {
    // eslint-disable-next-line no-await-in-loop
    items = await ddb.scan(params).promise();
    items.Items?.forEach((item) => result.push(item));
    params.ExclusiveStartKey = items.LastEvaluatedKey;
  } while (typeof items.LastEvaluatedKey !== 'undefined');

  return result;
}
