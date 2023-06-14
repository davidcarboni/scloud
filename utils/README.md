# Utility functions

A collection of functions to help take care of boilerplate, mainly when working in Lambda.

## Functions

 * *parseJson* A wrapper around `JSON.parse` that gracefully returns undefined if the input can't be parsed. This is useful for parsing things like HTTP/API request messages and SQS bodies without needing to add a try/catch every time.

 ## DynamoDB

 * A set of common CRUD/list operations that help you focus on what you're trying to achieve by taking away a bunch of boilerplate work, e.g. `getItem`, `putItem`, `deleteItem`, `findItems` and equivalent functions that use an index.
