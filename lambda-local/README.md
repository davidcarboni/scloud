# Local Lambda runner

Allows you to run an API Gateway Proxy Lambda or an SQS Lambda locally.

## Getting started

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

#
# This will call sqsLocal() if '--local' is specified on the command line:
#
(async () => {
  if (process.argv.includes('--local')) {
    sqsLocal(handler);
  }
})();
```

Add a script to your `package.json` to trigger the code. Add `nodemon` as a dependency if you want to watch for changes, e.g.:

`nodemon src/lambda.ts --local`

You can now invoke your Lambda handler function with e.g.:

`curl -X POST -d "SQS messgae body content" http://localhost:3000`
