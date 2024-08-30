# Lambda API Gateway Proxy handler

A Lambda handler that routes API Gateway Proxy messages and returns an API Gateway Proxy Response.

This is a piece of useful boilerplate to handle the mechanics of routing, headers and cookies, catching any errors and handling 400, 405 and 500 errors (you can optionally handle 404 and 500 with your own handler functions).

## Releae notes

 * `0.3.5`: Enable parsing body as `application/x-www-form-urlencoded` as well as JSON
 * `0.3.5`: `actions/setup-node@v4` and Node `lts`
 * `0.3.4`: `ContextBuilder` no longer needs to return context values.
 * `0.3.3`: `actions/checkout@v4` and Node `20.x`
 * `0.3.2`: Add `ContextBuilder` to have the option to populate `Request.context` with access to the parsed `Request`.
 * `0.3.1`: Add path parameter parsing and a `Request.context` object to allow custom values to be passed to handter functions.
 * `0.2.4`: Allow Request.body to be `any`. Return simple text responses for handled errors (404, 500, 405).
 * `0.2.1`: Request headers are now made available in lowecase as well as their original case. The response body can now be `string` as well as `object`.
 * `0.2.2`: Add `Content-Type: text/plain` for string responses if not already set.

## Usage

Create your routes:

```
import { types } from '@scloud/lambda-api';

const routes: types.Routes = {
  '/ping': { GET: async (request: types.Request) => ({ statusCode: 200, body: {message: 'ok'} }) },
  '/path/{parameter}': { GET: async (request: types.Request) => ({ statusCode: 200, body: {message: request.pathParameters.parameter} }) },
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

## Release notes

* **0.1.24**: Decode Base-64 encoded event body if needed, before parsing as JSON
