# s3 CRUD utility functions

A collection of wrapper functions for the AWS SDKv3 that provide simplified CRUD and list operations.

This is intended to provide you with the operations you'll mostly need most of the time and, if you have an edge-case, you can use this as example code to help you get what you need done more easily.

## Changelog
 * **0.0.13**: `actions/setup-node@v4` and Node `lts`
 * **0.0.12**: `actions/checkout@v4` and Node `20.x`
 * **0.0.11**: Add `copyObject` and remove `console.error()` output in `src/s3.ts`
 * **0.0.10**: Fix `moveObject` and shortcut return from `deleteObjects` if the object list is empty. Also make error messages unique so we can distinguish if an error is coming from `deleteObject` or `deleteObjects`. Also added generic type information to `getJson` and `putJson`.
 * **0.0.9**: Add `deleteObjects`
 * **0.0.8**: Return ETag when listing objects
 * **0.0.7**: Fix typos in documentation
 * **0.0.6**: Return object size and modification date from listObjects. This allows the caller to have more information about an object (example use-case: determine if new content to be put differs from the existing content in the same way `aws s3 sync` does - https://stackoverflow.com/a/43531938/723506).

## Functions

This package allows you to work with binary and JSON objects.

### Binary objects

 * `putObject(bucket, key, object)`: puts content to s3
 * `getObject(bucket, key)`: gets content from s3

### JSON objests

 * `putJson(bucket, key, object)`: stringifies the object and puts it to s3
 * `getJson(bucket, key)`: gets content from s3 and parses it as JSON

### List and delete

 * `deleteObject(bucket, key)`: deletes an object from s3
 * `deleteObjects(bucket, keys[])`: deletes multiple objects from s3
 * `listObjects(bucket, prefix)`: lists matching keys from the bucket
 * `objectExists(bucket, key)`: determines whether a single matching key exists in the bucket
