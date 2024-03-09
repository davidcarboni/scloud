# Typescript Lambda

This component is a Lambda funcition that responds to requests via API Gateway

## Dependencies

Main:

* `@aws-sdk/client-dynamodb` - main Dynamodb client
* `@aws-sdk/lib-dynamodb` - additional Dynamodb functionality
* `@scloud/lambda-api` - helper library for parsing incoming requests and routing
* `@types/aws-lambda` - appears to be needed in the production dependencies, ideally would be in dev dependencies

Optional:

* `@scloud/lambda-local` - allows you to develop a Lambda locally by calling your habdler function using Express
* `@aws-sdk/client-s3` - included for convenience, only needed if you access s3
* `@aws-sdk/client-sqs` - included for convenience, only needed if you use sqs
* `@scloud/s3` - included for convenience, simplified wrappers for accessing objects in s3
* `@scloud/lambda-fileupload` - included for convenience, only needed if you need to accept file upload/download - API gateway & Lambda have payload limits of <10M so this gives you signed s3 URLs to work with that limit.

## Scripts

Scripts in `package.json`:

* `local`: Run the function for local development. Note that only your handler function will run so if you need to access other resources (e.g. dynamodb) you'll need credentials/setup locally that allow you to access those resources
* `lint`: run ESLint on the codebase
* `test`: run Typescript unit tests (no nees to compiile to Javascript at this point)
* `test:integration`: run integration tests - these are intended to programmatically exercise the API this Lambda provides
* `compile`: conpile Typescript to `/js` output directory
* `package`: package Javascript code from the `js` directory and create `dist/function.zip` build package

## Build

To build the function for deployment, run:

* `yarn lint` - linting check
* `yarn test` - unit tests
* `yarn compile` - compile TS to JS
* `yarn package` - build deployment package fropm compiled Javascript
