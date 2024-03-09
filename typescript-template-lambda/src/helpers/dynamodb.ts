import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand,
} from '@aws-sdk/lib-dynamodb';

//
// Helper functions for accessing Dynamodb
//
// Work in progress! However most basic operations are available and working,
//
// Donated by David Carboni
//

// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/dynamodb-example-dynamodb-utilities.html

export const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient(),
  // This should handle keys that are undefined
  { marshallOptions: { removeUndefinedValues: true } },
);

export interface Key {
  name: string,
  value: any,
}

export interface Range {
  name: string,
  from: any,
  to: any,
}

export function ttlMinutes(minutes: number) {
  const date = new Date();
  date.setDate(date.getMinutes() + minutes);
  return Math.floor(date.getTime() / 1000.0);
}

export function ttlHours(hours: number) {
  const date = new Date();
  date.setDate(date.getHours() + hours);
  return Math.floor(date.getTime() / 1000.0);
}

export function ttlDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return Math.floor(date.getTime() / 1000.0);
}

export function ttlMonths(months: number) {
  const date = new Date();
  date.setDate(date.getMonth() + months);
  return Math.floor(date.getTime() / 1000.0);
}

export function ttlYears(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return Math.floor(date.getTime() / 1000.0);
}

/**
 * Get an item
 * @param tableName DynamoDB table name
 * @param key 1-2 fields: partition key (required) and, optionally, sort key
 * @returns The item, if found, or {}
 */
export async function getItem(tableName: string, key: { [key: string]: any; })
  : Promise<{ [key: string]: any; } | undefined> {
  const response = await documentClient.send(new GetCommand({
    TableName: tableName,
    Key: key,
  }));
  return response.Item;
}

/**
 * Delete an item
 * @param tableName DynamoDB table name
 * @param key 1-2 fields: partition key (required) and, optionally, sort key
 * @returns The item, if found, or {}
 */
export async function deleteItem(tableName: string, key: { [key: string]: any; })
  : Promise<{ [key: string]: any; } | undefined> {
  const response = await documentClient.send(new DeleteCommand({
    TableName: tableName,
    Key: key,
  }));
  return response.Attributes;
}

/**
 * Get an item using an index
 * @param tableName DynamoDB table name
 * @param indexName Index name
 * @param id The item ID (partition key)
 * @returns The item, if found, or {}
 */
export async function getIndex(tableName: string, indexName: string, indexKey: string, indexValue: any)
  : Promise<{ [key: string]: any; } | undefined> {
  const response = await documentClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: `${indexKey} = :value`,
    ExpressionAttributeValues: {
      ':value': indexValue,
    },
  }));
  return response.Items && response.Items.length > 0 ? response.Items[0] : undefined;
}

/**
 * Put an item
 * @param tableName DynamoDB table name
 * @param item Must include the partition key and, if defined, the sort key
 */
export async function putItem(tableName: string, item: { [key: string]: any; }) {
  await documentClient.send(new PutCommand({
    TableName: tableName,
    Item: item,
  }));
}

// /**
//  * Update an item
//  * @param tableName DynamoDB table name
//  * @param item Must include the partition key and, if defined, the sort key
//  */
// export async function updateItem(tableName: string, key: { [key: string]: any; }, values: { [key: string]: any; }) {
//   const response = await documentClient.send(new UpdateCommand({
//     TableName: tableName,
//     Key: key,
//     UpdateExpression: "set Color = :color",
//     ExpressionAttributeValues: {
//       ":color": "black",
//     },
//     ReturnValues: "ALL_NEW",
//   }));
//   console.log(response);
//   return response;
// }

/**
 * https://stackoverflow.com/questions/44589967/how-to-fetch-scan-all-items-from-aws-dynamodb-using-node-js
 * @param tableName DynamoDB table name
 * @returns All the items that match the partition key and begin with the sort key
 */
export async function findItems(
  tableName: string,
  partitionKey: Key,
  sortKey?: Key,
  // attributes?: string[],
): Promise<{ [key: string]: any; }[]> {
  // Primary key
  let KeyConditionExpression = '#pk = :pk';
  const ExpressionAttributeNames: { [key: string]: any; } = {
    '#pk': partitionKey.name,
  };
  const ExpressionAttributeValues: { [key: string]: any; } = {
    ':pk': partitionKey.value,
  };

  // Sort key
  if (sortKey) {
    KeyConditionExpression = `${KeyConditionExpression} AND begins_with ( #sk, :sk )`;
    ExpressionAttributeNames['#sk'] = sortKey.name;
    ExpressionAttributeValues[':sk'] = sortKey.value;
  }

  // Parameters
  const params: any = {
    TableName: tableName,
    KeyConditionExpression,
    ExpressionAttributeValues,
    ExpressionAttributeNames,
  };
  // const attributeNames = [partitionKey.name, sortKey.name];

  // List of attributes to get
  // if (attributes) {
  //   params.ProjectionExpression = attributes.map((attribute) => `#${attribute}`).join(',');
  //   attributes.forEach((attribute) => {
  //     attributeNames.push(attribute);
  //   });
  // }

  // Expression attribute names - this avoids clashing with DDB reserved words
  // attributeNames.forEach((attributeName) => {
  //   params.ExpressionAttributeNames[`#${attributeName}`] = `${attributeName}`;
  // });

  const result: { [key: string]: any; }[] = [];
  let response;
  do {
    // eslint-disable-next-line no-await-in-loop
    response = await documentClient.send(new QueryCommand(params));
    if (response.Items) response.Items.forEach((item) => result.push(item));
    params.ExclusiveStartKey = response.LastEvaluatedKey;
  } while (typeof response.LastEvaluatedKey !== 'undefined');

  return result;
}

// /**
//  * https://stackoverflow.com/questions/44589967/how-to-fetch-scan-all-items-from-aws-dynamodb-using-node-js
//  * @param tableName DynamoDB table name
//  * @param indexName DynamoDB table index
//  * @returns All the items that match the partition key and begin with the sort key
//  */
// export async function findItemsIndex(
//   tableName: string,
//   indexName: string,
//   partitionKey: Key,
//   sortKey?: Key,
// ) : Promise<{ [key: string]: any; }[]> {
//   const params: DocumentClient.QueryInput = {
//     TableName: tableName,
//     IndexName: indexName,
//     KeyConditionExpression: sortKey ? '#pk = :pk AND begins_with ( #sk, :sk )' : '#pk = :pk',
//     ExpressionAttributeNames: {
//       '#pk': partitionKey.name,
//     },
//     ExpressionAttributeValues: {
//       ':pk': partitionKey.value,
//     },
//   };

//   // Add sort key if specified
//   if (sortKey) {
//     params.ExpressionAttributeNames = params.ExpressionAttributeNames || {}; // Some Typrscript issue?
//     params.ExpressionAttributeValues = params.ExpressionAttributeValues || {}; // Some Typrscript issue?
//     params.ExpressionAttributeNames['#sk'] = sortKey.name;
//     params.ExpressionAttributeValues[':sk'] = sortKey.value;
//   }

//   const result: { [key: string]: any }[] = [];
//   let items;
//   do {
//     // eslint-disable-next-line no-await-in-loop
//     items = await ddb.query(params).promise();
//     if (items.Items) items.Items.forEach((item) => result.push(item));
//     params.ExclusiveStartKey = items.LastEvaluatedKey;
//   } while (typeof items.LastEvaluatedKey !== 'undefined');

//   return result;
// }

// /**
//  * Selects a range of items between two sort keys
//  * @param tableName DynamoDB table name
//  * @param partitionKey The partition key to select
//  * @param sortKey The starting/ending sort key values
//  * @returns An array of items in the given sort key range
//  */
// export async function findItemRange(
//   tableName: string,
//   partitionKey: Key,
//   sortKey: Range,
//   attributes?: string[],
// ): Promise<{ [key: string]: any }[]> {
//   const params: any = {
//     TableName: tableName,
//     KeyConditionExpression: `#${partitionKey.name} = :pk AND #${sortKey.name} BETWEEN :from AND :to`,
//     ExpressionAttributeValues: {
//       ':pk': partitionKey.value,
//       ':from': sortKey.from,
//       ':to': sortKey.to,
//     },
//     ExpressionAttributeNames: {}, // Computed below
//   };
//   const attributeNames = [partitionKey.name, sortKey.name];

//   // List of attributes to get
//   if (attributes) {
//     params.ProjectionExpression = attributes.map((attribute) => `#${attribute}`).join(',');
//     attributes.forEach((attribute) => {
//       attributeNames.push(attribute);
//     });
//   }

//   // Expression attribute names - this avoids clasking with DDB reserved words
//   attributeNames.forEach((attributeName) => {
//     params.ExpressionAttributeNames[`#${attributeName}`] = `${attributeName}`;
//   });

//   const result: { [key: string]: any }[] = [];
//   let items;
//   do {
//     // eslint-disable-next-line no-await-in-loop
//     items = await ddb.query(params).promise();
//     if (items.Items) items.Items.forEach((item) => result.push(item));
//     params.ExclusiveStartKey = items.LastEvaluatedKey;
//   } while (typeof items.LastEvaluatedKey !== 'undefined');

//   return result;
// }

// /**
//  * https://stackoverflow.com/questions/44589967/how-to-fetch-scan-all-items-from-aws-dynamodb-using-node-js
//  * @param tableName DynamoDB table name
//  * @returns An array containing all the items (could get large!)
//  */
// export async function listItems(tableName: string): Promise<{ [key: string]: any }[]> {
//   const params: ScanInput = {
//     TableName: tableName,
//   };

//   const result: { [key: string]: any }[] = [];
//   let items;
//   do {
//     // eslint-disable-next-line no-await-in-loop
//     items = await ddb.scan(params).promise();
//     items.Items?.forEach((item) => result.push(item));
//     params.ExclusiveStartKey = items.LastEvaluatedKey;
//   } while (typeof items.LastEvaluatedKey !== 'undefined');

//   return result;
// }

// /**
//  * Data migration for a set of DynamoDB iems.
//  * @param table The DDB table to write to
//  * @param page A page of DDB items returned by the scan.
//  * @param update A function that takes a DDB item as a parameter,
//  * updates the object and returns it to be put bach to the table.
//  * @returns The number of updates made
//  */
// export async function migratePage(
//   table: string,
//   page: DocumentClient.ItemList,
//   update: Function,
// ): Promise<number> {
//   const batches: Promise<any>[] = [];

//   // Filter out any blanks (i.e. items that don't need to be updated)
//   const items = page.map((item) => update(item));
//   let puts = (await Promise.all(items)).filter((item) => item);
//   const count = puts.length;

//   // Process puts
//   const batchSize = 25;
//   while (puts.length > 0) {
//     // Comvert the page of items into batches of 25 items (the ddb batch-size limit)
//     const batch = puts.slice(0, batchSize);
//     puts = puts.slice(batchSize);

//     if (batch.length > 0) {
//       // Run the batch
//       batches.push(ddb.batchWrite({
//         RequestItems: {
//           [table]: batch.map((item) => ({ PutRequest: { Item: item } })),
//         },
//       }).promise());
//     }
//   }

//   // Await completion of batches
//   await Promise.all(batches);

//   console.log(`Processed ${batches.length} batches for ${count} items from a page of ${page.length}`);
//   return count;
// }

// /**
//  * Data migration for a DynamoDB table.
//  * @param update A function that takes a DDB item as a parameter,
//  * updates the object and returns it to be put bach to the table.
//  * @param sourceTable The DDB table to scan
//  * @param destinationTable (Optional) The DDP table to updated items into,
//  * If not provided, items are put back to the source table.
//  */
// export async function migrate(update: Function, sourceTable: string, destinationTable?: string)
//   : Promise<number> {
//   const params: ScanInput = {
//     TableName: sourceTable,
//   };

//   let count = 0;
//   let result: DocumentClient.ScanOutput;
//   do {
//     // eslint-disable-next-line no-await-in-loop
//     result = await ddb.scan(params).promise();
//     // eslint-disable-next-line no-await-in-loop
//     if (result.Items) count += await migratePage(`${destinationTable || sourceTable}`, result.Items, update);
//     console.log(`Migrated ${count} items`);
//     params.ExclusiveStartKey = result.LastEvaluatedKey;
//   } while (typeof result.LastEvaluatedKey !== 'undefined');

//   return count;
// }
