import {
  CopyObjectCommand,
  DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
// eslint-disable-next-line import/no-extraneous-dependencies
import { StreamingBlobPayloadOutputTypes } from '@smithy/types';
import * as fs from 'fs';
import { Readable } from 'stream';

// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html

const client = new S3Client({});

/**
 * Updates the created date on an s3 object by copying it to itself and setting the storage class to STANDARD.
 * See: https://stackoverflow.com/a/18730911/723506
 *
 * This is useful if you want to set an expiration on a bucket and want to 'touch' objects to keep them from expiring.
 * It's useful for allowing unused content to expire, but keeping content that is still actively being used.
 */
export async function touchObject(bucket: string, key: string): Promise<boolean> {
  const command = new CopyObjectCommand({
    Bucket: bucket,
    Key: key,
    CopySource: `${bucket}/${key}`,
    StorageClass: 'STANDARD',
  });

  try {
    await client.send(command);
    return true;
  } catch (e) {
    console.error('Error putting', key, (e as Error).stack);
    return false;
  }
}

/**
 * Moves an object in s3 by doing a copy, followed by a delete.
 */
export async function moveObject(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<boolean> {
  const copyCommand = new CopyObjectCommand({
    Bucket: toBucket,
    Key: toKey,
    CopySource: `${fromBucket}/${fromKey}`,
  });
  const deleteCommand = new DeleteObjectCommand({
    Bucket: fromBucket,
    Key: fromKey,
  });

  try {
    await client.send(copyCommand);
  } catch (e) {
    console.error('Error moving object: could not copy from', `${fromBucket}/${fromKey}`, 'to', `${toBucket}/${toKey}`, (e as Error).stack);
    return false;
  }

  try {
    await client.send(deleteCommand);
  } catch (e) {
    console.error('Error moving objet: could not delete original from', `${fromBucket}/${fromKey}`, (e as Error).stack);
    return false;
  }

  return true;
}

/**
 * @param object In Node this is string | Uint8Array | Buffer | Readable, in a browser this is string | Uint8Array | ReadableStream | Blob
 * @returns True for success, false for failure
 */
export async function putObject(bucket: string, key: string, object: string | Uint8Array | Buffer | Readable): Promise<boolean> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: object,
  });

  try {
    await client.send(command);
    return true;
  } catch (e) {
    console.error('Error putting', key, (e as Error).stack);
    return false;
  }
}

/**
 * @param object This will be converted to a string using JSON.stringify
 * @returns True for success, false for failure
 */
export async function putJson(bucket: string, key: string, object: any): Promise<boolean> {
  return putObject(bucket, key, JSON.stringify(object));
}

/**
 *
 * @param bucket
 * @param key
 * @returns Undefined for failure or, in Node SdkStream<IncomingMessage | Readable> or, in a browser SdkStream<ReadableStream | Blob> (see AWS types for more innformation)
 */
export async function getObject(bucket: string, key: string): Promise<StreamingBlobPayloadOutputTypes | undefined> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);
    return response.Body;
  } catch (e) {
    console.error('Error retrieving', key, (e as Error).stack);
    return undefined;
  }
}

/**
 * @param object This will be converted to a string using JSON.stringify
 * @returns Undefined for failure, or an object parsed from JSON
 */
export async function getJson(bucket: string, key: string): Promise<any | undefined> {
  const result = await getObject(bucket, key);
  if (result) {
    try {
      const body = await result.transformToString();
      return JSON.parse(body);
    } catch (e) {
      console.error('Error parsing content to JSON', key, (e as Error).stack);
    }
  }
  return undefined;
}

/**
 * Deletes an object from s3.
 * @returns If the delete command was successful, true, otherwise false
 */
export async function deleteObject(bucket: string, key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (e) {
    console.error('Error deleting object', key, (e as Error).stack);
    return false;
  }
}

/**
 * Deletes multiple objects from s3.
 * @returns If the delete command was successful, the number of objects deleted, otherwise undefined
 */
export async function deleteObjects(bucket: string, keys: string[]): Promise<number | undefined> {
  // Shortcut return (plus AWS seems to throw an error for an emply delete list)
  if (keys.length === 0) return 0;

  try {
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    });

    const result = await client.send(command);
    return result.Deleted?.length;
  } catch (e) {
    console.error('Error deleting objects', keys.slice(0, 10), keys.length > 10 ? `... (${keys.length})` : '', (e as Error).stack);
    return undefined;
  }
}

/**
 * Default maxKeys is 1000
 */
export async function listObjects(bucket: string, prefix?: string): Promise<Record<string, { modified?: Date, size?: number, etag?: string; }>> {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  const result: Record<string, { modified?: Date, size?: number, etag?: string; }> = {};
  try {
    const { Contents } = await client.send(command);
    if (Contents) Contents.forEach((c) => { if (c.Key) result[c.Key] = { modified: c.LastModified, size: c.Size, etag: c.ETag }; });
  } catch (e) {
    console.error('Error listing', prefix, (e as Error).stack);
  }
  return result;
}

/**
 * List a key to see if it exists in the bucket
 * @returns true if a single matching key exists
 */
export async function objectExists(bucket: string, key: string): Promise<boolean> {
  const found = await listObjects(bucket, key);
  return Object.keys(found).length === 1;
}

/**
 * Downloads a file from s3 to a local temp file (or a path you provide)
 * @param key Key in s3 of object to download
 * @param bucket Bucket to download from
 * @param path Optional: local file path to save to. Defaults to `/tmp/${key}` which is valid fot Lambda (up to 500MB at the time of writing)
 * @returns The path to the downloaded file (either the provided path or the default of `/tmp/${key}`)
 */
export async function downloadTemp(key: string, bucket: string, path?: string): Promise<string> {
  try {
    // Download
    const body = await getObject(bucket, key);

    // Write to a temp file
    const temppath = path || `/tmp/${key}`;
    fs.writeFileSync(temppath, await body?.transformToByteArray() || '');
    return temppath;
  } catch (err) {
    throw new Error(`Error downloading ${key} from ${bucket}:\n${(err as Error).stack}`);
  }
}
