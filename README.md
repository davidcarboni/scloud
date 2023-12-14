# scloud

_AWS CDK patterns and NPM packages for assembling serverless infrastructures_

Getting started: `npm i @scloud/cdk-patterns @scloud/cdk-github`

 * CDK Patterns: **@scloud/cdk-patterns** https://www.npmjs.com/package/@scloud/cdk-patterns
 * CDK Gitgub Actions Integration: **@scloud/cdk-github** https://www.npmjs.com/package/@scloud/cdk-github
 * More useful packages: **@scloud** https://www.npmjs.com/org/scloud

This repo contains a set of AWS CDK patterns packaged as functions and constructs so you can put serverless architectures together in fewer lines of code. The aim is to make it easy to clip together typical infrastructure building blocks that can be reused (and tweaked) across your projects.

It's bunch of things done well that you can benefit from. I use it to store chunks of reference code I use each time I build a new service.

If you want to do infrastructure well, without making AWS your life's work, then scloud could be what you need.

## NPM packages

This repo contains a bunch of useful example code. If you'd prefer to install some useful libraries to get going with creating serverless infrastructure and code, I've published a bunch of packages on NPM:

### Infrastructure as code and CI/CD

These packages focus on clipping together serverless infrastructure with AWS CDK (Cloudformation) and integrating with Github actiond CI/CD for environment, variable and secrets handling:

 * *@scloud/cdk-patterns* - patterns I use regularly to put together serverless architectures: https://www.npmjs.com/package/@scloud/cdk-patterns
 * *@scloud/cdk-github* - works with the CDK patterns to automate setting secrets and variables in Github Actions, based on the outputs of the `ghaUser` pattern: https://www.npmjs.com/package/@scloud/cdk-github

### Standard Lambda handlers

These packages give you template Lambda handlers so you can develop for common use-cases with more consistency and less boilerplate:

 * *@scloud/lambda-queue* - a helper function to take the boilerplate out of building Lambda functions that handle SQS messages
essages: https://www.npmjs.com/package/@scloud/lambda-queue
 * *@scloud/lambda-api* - a helper function to take the boilerplate out of building Lambda functions that handle API Gateway proxy requests
essages: https://www.npmjs.com/package/@scloud/lambda-api

### Local development

These packages help reduce your cycle time from minutes to seconds and make developing Lambdas feel enjoyable and productive:

 * *@scloud/lambda-local* - enables you to run a Lambda habdler locally for development using an Express server to translate HTTP requests to Lambda events. Implemented for API Gateway and SQS: https://www.npmjs.com/package/@scloud/lambda-local

### Utilities and patterns

These packages help you build for common use-cases, skipping boilerplate and avoiding complexity:

 * *@scloud/lambda-fileupload* - implements file upload/download with API Gateway and Lambda to avoids request/response size limits by using presigned URLs to access s3 directly
essages: https://www.npmjs.com/package/@scloud/lambda-fileupload
 * *@scloud/s3* - CRUD and listing functions for s3
essages: https://www.npmjs.com/package/@scloud/s3
 * *@scloud/utils* - utility functions for acessing dynamodb and graceful json parsing
essages: https://www.npmjs.com/package/@scloud/utils

## Scloud structure and conventions

Scloud makes a few assumptions about what the repository structure looks like:

 * A folder `/infrastructure` containing CDK Cloudformation Stack code
 * A folder `/infrastructure/secrets` containing inputs for the stack, outputs from stack deployment and optionally Github credentials for automating setting variables and secrets on your repository
 * Folders at the top level (alongside `/infrastructure`) that represent deployable components (e.g. Lambda function code)
 * Actions workflows under `.github/workflows` named to match deployable components (e.g. a top-level folder `/component1` would have a matching workflow called `.github/workflows/component1.yml`)
 * By convention, each deployable component has a correspondingly-named function in the CDK code that builds the infrastructure for that component (e.g. `/component1` would relate to a function called `component1()` in `/infrastructure/lib/project-stack.ts`)

 The aim is to reduce cognitive load and build good expectations about the pieces that make up your system.

## Github secrets and variables

The other folder you'll want to look in is: https://github.com/davidcarboni/scloud/tree/main/cdk-github/src or the package `@scloud/cdk-github`

If you use Github Actions, chances are you'll want to pass variables and secrets from your infrasturcture build to your Github Actions workflows, for example generated bucket and Lambda names. Once you're set up, you can use `npm run secrets` to read in values output by CDK deploy and use them to set up secrets and variables on Github automatically.

## Infrastructure setup and utilities

There are a bunch of example scripts and setup under https://github.com/davidcarboni/scloud/tree/main/infrastructure

A couple of key files are `dependencies.sh` (changes you may want to make to package.json) and `deploy.sh` (a usedul CDK deployment script). You'll also want to look at the `/secrets` directory - this is where you'll want to create `*.sh` files that can be sourced by `deploy.sh` to supply values to your infrastructure build.

## Why the name 'Scloud'?

What's the 'S' in Scloud? Mainly serverless, definitely simple and, depending on how you're feeling about this library at the time, possibly some other words!

These patterns are designed to be basic and not finely configurable, on the basis that keeping things standad, simple, even a bit 'stupid' is a good way to get things done and get on with life.
