# @scloud/lambda-bundle

esbuild bundlers for Lambda deployment packages and CloudFront Functions.

## Lambda

Produces `dist/lambda.js` for handler `lambda.handler`.

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

## CloudFront Functions

Bundles every `src/*Function.ts` to `dist/<name>.js` using ES5 IIFE output for the CloudFront Functions runtime.

Each source file should assign the handler globally (esbuild IIFE output):

```typescript
function handler(event: Event) { /* ... */ }
(globalThis as any).handler = handler;
```

```json
"scripts": {
  "compile": "tsc --noEmit",
  "package": "cf-bundle"
}
```

Or specify functions explicitly:

```typescript
import { bundleCloudFrontFunctions } from '@scloud/lambda-bundle';

bundleCloudFrontFunctions({
  functions: [
    { entryPoint: 'src/websiteFunction.ts', outfile: 'dist/websiteFunction.js' },
  ],
});
```

`cf-bundle` warns when any output exceeds the 10 KB CloudFront Functions size limit.

## Release notes

 * **1.2.0**: Add `cf-bundle` CLI and `bundleCloudFrontFunctions` for CloudFront Functions.
 * **1.1.0**: Merge custom `external` packages with defaults (`aws-sdk`) instead of replacing them.
 * **1.0.1**: Initial release.
