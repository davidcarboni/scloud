# Local Lambda runner

Allows you to run an API Gateway Proxy Lambda or an SQS Lambda locally.

## Getting started

Add code to start a local server to the bottom of your lambda hamdler file (e.g. `src/lambda.ts`)

```
import { sqsLocal } from '@scloud/lambda-local';

export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  # Lambda handler code
}

(async () => {
  if (process.argv.includes('--local')) {
    sqsLocal(handler);
  }
})();
```

Add a script to your `package.json` to trigger the code (add `nodemon` as a dependency if you want to watch for changes):

`nodemon src/lambda.ts --local`

You can now invoke your Lambda handler function with e.g.:

`curl -X POST -d "SQS messgae body content" http://localhost:3000`
