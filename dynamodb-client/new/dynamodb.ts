import { parse } from '../types/helper';
import { DynamoDBClient, QueryCommandOutput } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, BatchWriteCommand, UpdateCommand,
  ScanCommandInput, ScanCommand,
  ScanCommandOutput,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import z from 'zod';

// https://github.com/awsdocs/aws-doc-sdk-examples/tree/main/javascriptv3/example_code/dynamodb/actions/document-client

export const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient(),
  // This should handle keys that are undefined
  { marshallOptions: { removeUndefinedValues: true } },
);

export interface Key {
  index?: string,
  name: string,
  value: unknown,
}

export interface Range {
  index?: string,
  name: string,
  from: unknown,
  to: unknown,
}

export function ttlMinutes(minutes: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return Math.floor(date.getTime() / 1000.0);
}

export function ttlHours(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return Math.floor(date.getTime() / 1000.0);
}

export function ttlDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return Math.floor(date.getTime() / 1000.0);
}

export function ttlMonths(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return Math.floor(date.getTime() / 1000.0);
}

export function ttlYears(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return Math.floor(date.getTime() / 1000.0);
}

export function experssionAttributes(values: { [key: string]: unknown; }) {
  const fields: string[] = [];
  const ExpressionAttributeNames: { [key: string]: string; } = {};
  const ExpressionAttributeValues: { [key: string]: unknown; } = {};
  for (const [key, value] of Object.entries(values)) {
    fields.push(`#${key} = :${key}`);
    ExpressionAttributeNames[`#${key}`] = key;
    ExpressionAttributeValues[`:${key}`] = value;
  }
  return { fields, ExpressionAttributeNames, ExpressionAttributeValues };
}

function verifyItem<T extends z.ZodTypeAny>(item: Record<string, unknown> | undefined, schema: T): z.infer<T> | undefined {
  if (!item) return undefined;
  const parsed = parse(item, schema);
  if (parsed.error) throw new Error(`Failed to parse item: ${JSON.stringify(parsed.error.issues)}`);
  return parsed.value;
}

/**
 * Get an item
 * @param tableName DynamoDB table name
 * @param key 1-2 fields: partition key (required) and, optionally, sort key
 * @returns The item, if found, or {}
 */
export async function getItem<T extends z.ZodTypeAny>(tableName: string, key: Partial<z.infer<T>>, schema: T): Promise<z.infer<T> | undefined> {
  const response = await documentClient.send(new GetCommand({
    TableName: tableName,
    Key: key,
  }));
  return verifyItem(response.Item, schema);
}

/**
 * Get an item using an index
 * @param tableName DynamoDB table name
 * @param indexName Index name
 * @param id The item ID (partition key)
 * @returns The item, if found, or {} (NB this is a query limited to 1 item)
 */
export async function getItemIndex<T extends z.ZodTypeAny>(tableName: string, schema: T, indexName: string, partitionKey: Key, sortKey?: Key): Promise<z.infer<T> | undefined> {
  const items = await getItems(tableName, schema, indexName, partitionKey, sortKey, 1);
  return items[0];
}

/**
 * https://stackoverflow.com/questions/44589967/how-to-fetch-scan-all-items-from-aws-dynamodb-using-node-js
 * @param tableName DynamoDB table name
 * @returns All the items that match the partition key and begin with the sort key
 */
export async function getItems<T extends z.ZodTypeAny>(
  tableName: string,
  schema: T,
  indexName: string | undefined,
  partitionKey: Key,
  sortKey?: Key | undefined,
  limit?: number,
): Promise<z.infer<T>[]> {
  // Partition key
  const ExpressionAttributeNames: { [key: string]: string; } = { '#pk': partitionKey.name };
  const ExpressionAttributeValues: { [key: string]: unknown; } = { ':pk': partitionKey.value };

  // Sort key
  if (sortKey) {
    ExpressionAttributeNames['#sk'] = sortKey.name;
    ExpressionAttributeValues[':sk'] = sortKey.value;
  }

  // Parameters
  const params: QueryCommandInput = {
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: sortKey ? '#pk = :pk AND begins_with ( #sk, :sk )' : '#pk = :pk',
    ExpressionAttributeNames: sortKey ? { ...ExpressionAttributeNames, '#sk': sortKey.name } : ExpressionAttributeNames,
    ExpressionAttributeValues: sortKey ? { ...ExpressionAttributeValues, '#sk': sortKey.value } : ExpressionAttributeValues,
    Limit: limit,
  };

  const result: z.infer<T>[] = [];
  let response: QueryCommandOutput;
  do {
    response = await documentClient.send(new QueryCommand(params));
    if (response.Items) {
      const parsed = response.Items.map((item) => verifyItem(item, schema)).filter((item) => item !== undefined);
      result.push(...parsed);
    }
    params.ExclusiveStartKey = response.LastEvaluatedKey;
  } while (response.LastEvaluatedKey);

  return result;
}

/**
 * Selects a range of items between two sort keys
 * @param tableName DynamoDB table name
 * @param partitionKey The partition key to select
 * @param sortKey The starting/ending sort key values
 * @returns An array of items in the given sort key range
 */
export async function findItemRange<T extends z.ZodTypeAny>(
  tableName: string,
  schema: T,
  partitionKey: Key,
  sortKey: Range,
  indexName?: string,
): Promise<z.infer<T>[]> {

  const params: QueryCommandInput = {
    TableName: tableName,
    IndexName: indexName,
    ExpressionAttributeNames: {
      '#pk': partitionKey.name,
      '#sk': sortKey.name,
    },
    ExpressionAttributeValues: {
      ':pk': partitionKey.value,
      ':from': sortKey.from,
      ':to': sortKey.to,
    },
    KeyConditionExpression: `#pk = :pk AND #sk BETWEEN :from AND :to`,
  };

  const result: z.infer<T>[] = [];
  let response: QueryCommandOutput;
  do {
    response = await documentClient.send(new QueryCommand(params));
    if (response.Items) {
      const parsed = response.Items.map((item) => verifyItem(item, schema)).filter((item) => item !== undefined);
      result.push(...parsed);
    }
    params.ExclusiveStartKey = response.LastEvaluatedKey;
  } while (response.LastEvaluatedKey);

  return result;
}

/**
 * Put an item
 * @param tableName DynamoDB table name
 * @param item Must include the partition key and, if defined, the sort key
 */
export async function putItem<T extends { [key: string]: unknown; }>(tableName: string, item: T) {
  await documentClient.send(new PutCommand({
    TableName: tableName,
    Item: item,
  }));
}

/**
 * Put a batch of items.
 * Internally this will make BatchWrite requests for up to 25 items at a time until all items have been processed.
 * @param tableName DynamoDB table name
 * @param items These must include the partition key and, if defined, the sort key
 */
export async function putItems<T extends { [key: string]: unknown; }>(tableName: string, items: T[]) {
  if (items.length === 0) return; // Short-circuit exit, for convenience of caller being able to ssend an array of items without checking if it's empty

  let remaining: T[] = items;
  do {
    // Select a batch of up to 25 items (DDB limit)
    const batch = remaining.slice(0, 25);
    remaining = remaining.slice(25);

    await documentClient.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map((Item) => ({
          PutRequest: {
            Item,
          },
        })),
      },
    }));
  } while (remaining.length > 0);
}

/**
 * Update an item
 * NB you can't update the partition key or sort key.
 * If you want to change these you'll need to delete the item and put a new one.
 * @param tableName DynamoDB table name
 * @param key Partition key and, if defined, the sort key
 * @param values The values to update
 * @returns The attributes of the updated item
 */
export async function updateItem<T extends z.ZodTypeAny>(tableName: string, key: Partial<z.infer<T>>, values: Partial<z.infer<T>>): Promise<Record<string, unknown> | undefined> {

  // Build the update expression
  const { fields, ExpressionAttributeNames, ExpressionAttributeValues } = experssionAttributes(values);
  const response = await documentClient.send(new UpdateCommand({
    TableName: tableName,
    Key: key,
    UpdateExpression: `SET ${fields.join(', ')}`,
    ExpressionAttributeNames, // DynamoDB can be picky about reserved words like 'id' and 'type'. Using ExpressionAttributeNames avoids conflicts
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  }));

  return response.Attributes;
}

/**
 * Delete an item
 * @param tableName DynamoDB table name
 * @param key 1-2 fields: partition key (required) and, optionally, sort key
 * @returns The item, if found, or {}
 */
export async function deleteItem<T extends z.ZodTypeAny>(tableName: string, key: Partial<z.infer<T>>): Promise<{ [key: string]: unknown; } | undefined> {
  const response = await documentClient.send(new DeleteCommand({
    TableName: tableName,
    Key: key,
  }));

  return response.Attributes;
}

/**
 * https://stackoverflow.com/questions/44589967/how-to-fetch-scan-all-items-from-aws-dynamodb-using-node-js
 * @param tableName DynamoDB table name
 * @returns An array containing all the items (could get large!)
 */
export async function listItems<T extends z.ZodTypeAny>(tableName: string, schema: T): Promise<z.infer<T>[]> {
  const params: ScanCommandInput = {
    TableName: tableName,
  };

  let result: ScanCommandOutput;
  const items: z.infer<T>[] = [];

  do {
    result = await documentClient.send(new ScanCommand(params));
    if (result.Items) {
      const parsed = result.Items.map((item) => verifyItem(item, schema)).filter((item) => item !== undefined);
      items.push(...parsed);
    }
    params.ExclusiveStartKey = result.LastEvaluatedKey;
  } while (result.LastEvaluatedKey);

  return items;
}

/**
 * Data migration for a set of DynamoDB iems.
 * @param table The DDB table to write to
 * @param page A page of DDB items returned by the scan.
 * @param update A function that takes a DDB item as a parameter,
 * updates the object and returns it to be put bach to the table.
 * @returns The number of updates made
 */
export async function migratePage<T extends { [key: string]: unknown; }>(
  table: string,
  page: T[],
  update: (item: T) => T | undefined,
): Promise<number> {
  // Migrate items and filter out any blanks (aka items that don't need to be updated)
  const items = page.map((item) => update(item)).filter((item) => item !== undefined);
  await putItems(table, items);

  console.log(`Processed ${items.length} updates from a page of ${page.length}`);
  return items.length;
}

/**
 * Data migration for a DynamoDB table.
 * @param update A function that takes a DDB item as a parameter,
 * updates the object and returns it to be put bach to the table.
 * @param sourceTable The DDB table to scan
 * @param destinationTable (Optional) The DDP table to updated items into,
 * If not provided, items are put back to the source table.
 */
export async function migrate<T extends { [key: string]: unknown; }>(update: (item: T) => T | undefined, sourceTable: string, destinationTable?: string): Promise<number> {
  const params: ScanCommandInput = {
    TableName: sourceTable,
  };

  let itemCount = 0;
  let updateCount = 0;
  let result: ScanCommandOutput;

  do {
    result = await documentClient.send(new ScanCommand(params));
    if (result.Items) {
      itemCount += result.Items.length;
      updateCount += await migratePage(destinationTable || sourceTable, result.Items as T[], update);
    }
    console.log(`Migrated ${updateCount} of ${itemCount} items`);
    params.ExclusiveStartKey = result.LastEvaluatedKey;
  } while (result.LastEvaluatedKey);

  return updateCount;
}

export async function removeAttribute(table: string, attribute: string, dryRun: boolean = true): Promise<number> {
  let count = 0;
  migrate(item => {
    if (item[attribute]) count++;
    delete item[attribute];
    return dryRun ? undefined : item;
  }, table);

  console.log(`Removed ${count} ${attribute} attributes from ${table}`);
  return count;
}
