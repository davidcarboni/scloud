import {
  DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { StreamingBlobPayloadOutputTypes } from '@smithy/types';
import * as fs from 'fs';

// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html

const client = new S3Client({});

/**
 * @param object In Node this is string | Uint8Array | Buffer | Readable, in a browser this is string | Uint8Array | ReadableStream | Blob
 * @returns True for success, false for failure
 */
export async function putObject(bucket: string, key: string, object: any): Promise<boolean> {
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
    console.error('Error deleting', key, (e as Error).stack);
    return false;
  }
}

/**
   * Default maxKeys is 1000
   */
export async function listObjects(bucket: string, prefix?: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  const result: string[] = [];
  try {
    const { Contents } = await client.send(command);
    if (Contents) Contents.forEach((c) => { if (c.Key) result.push(c.Key); });
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
  return found.length === 1;
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
