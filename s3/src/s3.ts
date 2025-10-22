import {
  CopyObjectCommand,
  DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, GetObjectCommandOutput, paginateListObjectsV2, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { Readable } from 'stream';

// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html

const client = new S3Client({});

/**
 * Removes leading slash if present (and tidies up any double slashes)
 * See jarmod's comment on this SO question: https://stackoverflow.com/questions/76630400/aws-s3-nosuchkey-but-key-exists
 */
function cleanKey(key: string): string {
  return key.split('/').filter((p) => p).join('/');
}

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
    Key: cleanKey(key),
    CopySource: `${bucket}/${key}`,
    StorageClass: 'STANDARD',
  });

  try {
    await client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Moves an object in s3 by doing a copy, followed by a delete.
 */
export async function copyObject(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<boolean> {
  const copyCommand = new CopyObjectCommand({
    Bucket: toBucket,
    Key: cleanKey(toKey),
    CopySource: `${fromBucket}/${cleanKey(fromKey)}`,
  });

  try {
    await client.send(copyCommand);
  } catch {
    return false;
  }

  return true;
}

/**
 * Moves an object in s3 by doing a copy, followed by a delete.
 */
export async function moveObject(fromBucket: string, fromKey: string, toBucket: string, toKey: string): Promise<boolean> {
  await copyObject(fromBucket, fromKey, toBucket, toKey);

  const deleteCommand = new DeleteObjectCommand({
    Bucket: fromBucket,
    Key: cleanKey(fromKey),
  });

  try {
    await client.send(deleteCommand);
  } catch {
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
    Key: cleanKey(key),
    Body: object,
  });

  try {
    await client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param object This will be converted to a string using JSON.stringify
 * @returns True for success, false for failure
 */
export async function putJson<T>(bucket: string, key: string, object: T): Promise<boolean> {
  return putObject(bucket, key, JSON.stringify(object));
}


/**
 *
 * @param bucket
 * @param key
 * @returns Undefined for failure or, in Node SdkStream<IncomingMessage | Readable> or, in a browser SdkStream<ReadableStream | Blob> (see AWS types for more innformation)
 */
export async function getObject(bucket: string, key: string): Promise<GetObjectCommandOutput['Body']> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: cleanKey(key),
    });

    const response = await client.send(command);
    return response.Body;
  } catch {
    return undefined;
  }
}

/**
 * @param object This will be converted to a string using JSON.stringify
 * @returns Undefined for failure, or an object parsed from JSON
 */
export async function getJson<T>(bucket: string, key: string): Promise<T | undefined> {
  const result = await getObject(bucket, key);
  if (result) {
    try {
      const body = await result.transformToString();
      return JSON.parse(body);
    } catch {
      // Swallow error and return undefined
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
      Key: cleanKey(key),
    });
    await client.send(command);
    return true;
  } catch {
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

    const cleanKeys = keys.map((key) => cleanKey(key));
    let count = 0;
    do {
      // Remove a batch from the array of keys.
      // 1000 is the max number of objects that can be deleted in a single request
      const batch = cleanKeys.splice(-1000);

      // Send the delete command
      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
        },
      });
      const result = await client.send(command);

      // Count deletions
      result.Deleted?.forEach((deleted) => {
        if (deleted.Key) {
          count++;
        }
      });

    } while (cleanKeys.length > 0);

    // Return deleted count
    return count;

  } catch {
    return undefined;
  }
}

/**
 * List all object keys in the bucket that (optionally) match a prefix.
 */
export async function listObjects(bucket: string, prefix?: string, limit?: number): Promise<string[]> {
  const paginator = paginateListObjectsV2(
    { client },
    {
      Bucket: bucket,
      Prefix: prefix,
    }
  );

  const keys: string[] = [];

  for await (const page of paginator) {
    if (limit && keys.length >= limit) break;
    for (const obj of page.Contents || []) {
      if (obj.Key) {
        keys.push(obj.Key);
        if (limit && keys.length >= limit) break;
      }
    }
  }

  return keys;
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
 * @param bucket Bucket to download from
 * @param key Key in s3 of object to download
 * @param path Optional: local file path to save to. Defaults to `/tmp/${key}` which is valid fot Lambda (up to 500MB at the time of writing)
 * @returns The path to the downloaded file (either the provided path or the default of `/tmp/${key}`)
 */
export async function downloadTemp(bucket: string, key: string, path?: string): Promise<string> {
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
