# Local Lambda runner

Allows you to run an API Gateway Proxy Lambda or an SQS Lambda locally.

## Getting started

Here are a couple of examples of running Lambda handler functions locally.

You can add a script to your `package.json` to trigger the code. Add `nodemon` as a dependency if you want to watch for changes, e.g.:

```
  "scripts": {
    "local": "nodemon src/lambda.ts --local",
    ...
  }
```

If you'd like to run on a different port, you can set a `PORT` environment variable.

### A web app example

This example runs a Lambda handler as a dynamic web app, optionally mounting a local folder to serve static content as if it were an s3 bucket:

```
// import { webappLocal } from '@scloud/lambda-local';
// import * as path from 'path';

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  # Lambda handler code
}

(async () => {
  if (process.argv.includes('--local')) {
    const staticPath = path.join(__dirname, '/../../static/public');
    webappLocal(handler, { sourceDirectory: staticPath, appPath: '/public' });
  }
})();
```

You can now invoke your Lambda handler function via you bowser at `localhost:3000`

### An SQS example

Add code to start a local server to the bottom of your lambda hamdler file (e.g. `src/lambda.ts`)

```
// Also available: import { apiGatewayLocal } from '@scloud/lambda-local';
import { sqsLocal } from '@scloud/lambda-local';

/**
 * Your Lambda handler function
 */
export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  # Lambda handler code
}

//
// This will call sqsLocal() if '--local' is specified on the command line:
//
(async () => {
  if (process.argv.includes('--local')) {
    sqsLocal(handler);
  }
})();
```

You can now invoke your Lambda handler function with e.g.:

`curl -X POST -d "SQS messgae body content" http://localhost:3000`

## Available handlers

The following havdlers are available:

 * `sqsHandler` - takes the boby of a post as the content of an SQS message to be dlievered to your handler
 * `webappLocal` - takes the method, path, headers, query string and body of a request and delivers them to your handler. You can optionally add a local direcory to be served as static content, under a specific path on your app, as if it were an s3 bucket (e.g. `/static`)
 * `webappRoutesLocal` - works the same as `webappLocal` but allows you to pass multiple cloudfront path mappings to multiple handler functions (like a microservices setup). You can optionally add a local direcory to be served as a static content fallback, as if it were an s3 bucket. In other words, if a request doesn't match a mapped path, it will fall back to static content.
 * `scheduledLocal` - for Lambdas that run in response to scheduled Cloudwatch events. An http request on any method/path will call your Lambda handler with a placeholder event.
