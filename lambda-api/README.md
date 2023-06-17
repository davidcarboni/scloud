# Lambda API Gateway Proxy handler

A Lambda handler that routes API Gateway Proxy messages and returns an API Gateway Proxy Response.

This is a piece of useful boilerplate to handle the mechanics of routing, headers and cookies, catching any errors and handling 400, 405 and 500 errors (you can optionally handle 404 and 500 with your own handler functions).

## Usage

Create your routes:

```
import { types } from '@scloud/lambda-api';

const routes: types.Routes = {
  '/ping': { GET: async (request: types.Request) => ({ statusCode: 200, body: {message: 'ok'} }) },
}
```

Use `@scloud/lambda-api` in your Lambda handler:

```
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { apiHandler, helpers } from '@scloud/lambda-api';

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  const result = await apiHandler(event, context, routes);
  return result;
}
```

The `apiHandler` function will call your route functions according to the method and path of the request, catching any errors and returning 404/405 if a path/method isn't defined, or 500 if an error is thrown.
