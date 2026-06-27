# @scloud/lambda-bundle

esbuild bundler for Lambda deployment packages. Produces `dist/lambda.js` for handler `lambda.handler`.

## Usage

```json
"scripts": {
  "compile": "tsc --noEmit",
  "package": "lambda-bundle && cd dist && zip -r function.zip ."
}
```

For extra externals (e.g. native dependencies supplied via a Lambda layer):

```typescript
import { bundleLambda } from '@scloud/lambda-bundle';

bundleLambda({ external: ['sharp'] });
```

## Release notes

 * **1.1.0**: Merge custom `external` packages with defaults (`aws-sdk`) instead of replacing them.
 * **1.0.1**: Initial release.
