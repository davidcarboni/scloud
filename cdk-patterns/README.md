# CDK Patterns

Provides a set of functions that can be called to build common serverless CDK patterns.

This is intended to provide you with the patterns you'll mostly need most of the time and, if you have an edge-case, example code you can reuse that helps you get what you need done more easily.

See also this companion pacage to integrate your CDK infrastructure with Github Actions: @scloud/cdk-github https://www.npmjs.com/package/@scloud/cdk-github

## Overview

I'm publishing this to help others because I've been using it for a couple of years now and it's been a real help for projects I've worked on (personal and professional). It's grown organically, accumulating patterns I've reached for repeatedly, so there's no comprehensive documentation at his stage! Please be kind.

A couple of highlights:

 * `queueLambda()` - creates a Lambda function fed by an SQS queue
 * `webAppRoutes` - creates a Cloudfront distribution with a bucket for hosting static content (e.g. a React app) and Lambda functions to handle requests made to specific path prefixes
 * `cognitoPool` - creates a Cognito user pool and optionally configures Google, Facebook and SAML (sso) login
 * `ghaUser` - if you use Github Actions, this generates an IAM user access key with permission to deploy to resources defined in your stack (see also `addGha*` functions such as `addGhaSecret`, `addGhaVariable`, `addGhaLambda` etc.)

## Release notes
errorResponses
 * **0.9.2**: Add missing logoutUrl
 * **0.9.1**: Add the ability to pass a logoutUrl
 * **0.8.1**: Allow multiple callback URLs
 * **0.7.2**: Retire use of `OriginAccessIdentity` and switch to `.withOriginAccessControl` across all patterns as recommended by CDK documentation.
 * **0.7.1**: Switch to `withOriginAccessControl` for `WebApi`
 * **0.6.8**: Update remaining patterns to `S3BucketOrigin` fron `S3Origin` and fix bucket reference in `WebApi`
 * **0.6.7**: Add optional `errorResponses` for Cloudfront distributions in `WebApi`, `WebApp`, `WebFrontend` and `WebRoutes`.
 * **0.6.6**: Fix `domainName` not being propagated from `WebFrontend` when constructing `RedirectWww`.
 * **0.6.5**: Update to `S3BucketOrigin` fron `S3Origin`
 * **0.6.4**: `actions/checkout@v4`, `actions/setup-node@v4` and Node `lts`
 * **0.6.3**: Add `DynamoDbStreamFunction` - a Lambda that reads a DynamoDB table stream
 * **0.6.2**: Update default Python runtime to 3.12
 * **0.6.1**: Use `ContainerFunction` construct id as-is in (rather than appending `Function` to it).
 * **0.5.6**: Simplify and improve documentation comment for WebApi
 * **0.5.5**: First draft of WebApi pattern (e.g. mobile app backend)
 * **0.5.4**: Enable customising Cloudfront `defaultBehavior` in `DistributionProps`, which enables us to remove the explicit `WebRoutesProps.functionAssociation?` in favour of optionally passing this as part of `WebRoutesProps.distributionProps`
 * **0.5.3**: Add BuildsBucket
 * **0.5.2**: Add an optional handler to `ZipFunctionProps` so that a handler other than `src/lambda.handler` can be specified.
 * **0.5.1**: Update WwwRediect prop `domain` to `domainName` in to be clearer and more consistent with related constructs
 * **4.3.37**: Documentation update.
 * **4.3.36**: Fix genetating default https://auth.<zoneName> Cognito URLs if no domain prefix or explicit domain name is passed to the static Cognito creation functions.

## Constructs

The constructs in this library are designed to be fully serverless, which means they almost always cost nothing to provision with cost scaling according to traffic and storage above free tier limits.

One minor exception is that web-facing constructs typically take a HostedZone as input so that an SSL certificate can be provisioned. A HostedZone costs $0.50/mo at the time of writing. The upside is you can run a 24x7 web application or backend API on your custom domain (with a modest traffic) for less than **$1/mo**.

Compute conponents are typically `Lambda` (either a Node/Pythin zip file or a container), network constructs are `Cloudfront` and `API Gateway` and storage is `S3`, `SQS` and `DynamoDB` (on-demand rather than provisioned mode). Using a small subset of AWS services in a defined set of patterns keeps things relatively simple and helps you reason about how your architecture fits together.

### Lambda functions

These constructs allow you to create Lambda functions. You mostly don't need to use these directly. They're used by most of the patterns below. This secion documents them if you do need a raw function and so you can understand how the patterns are put together

#### `ZipFunction`

If you're using Node or Python, packaging your function as a zip file will give you a low cold-srtart time (at the time of writing). for an example of how to do this, see the top-level `/slack' example Lambda function (https://github.com/davidcarboni/scloud/tree/main/slack) and its accompanying GitHub Actions workflow (https://github.com/davidcarboni/scloud/blob/main/.github/workflows/slack.yml).

Basic usage:

```
const nodeFunction = ZipFunction.node(this, 'MyNodeFunction', {memorySize: 1024});
const pythonFunction = ZipFunction.python(this, 'MyNodeFunction', { timeout: 60 });
```

You can also instantiate the construct directly:

```
const myFunction = new  ZipFunction(this, 'MyFunction', {environment: { MY_ENV_VAR: 'my env value});
```

Note that props are optional and this construct defaults to:
 * 256M memory
 * 30s timeout
 * Runtime of Node, or Python if using `ZipFunction.python()`
 * Handler `src/lambda.handler`
 * Two year log retention
 * Inline code (which intentionally will not execute: `'Placeholder code'`)
 * The function description is set to the same value as the construct id to provide a human-friendly display in the AWS console listing

You can customise this construct via the `ZipFunctionProps` parameter, which gives you access to typical values you would want to change. If you need finer control, `ZipFunctionProps.functionProps` gived you full access to the CDK `FunctionProps`.

#### `ContainerFunction`

If you're using a non-standard runtime or prefer to package your functions as containers for standardisation because cold start times are less of an issue for you, then `ContainerFunction` is for you:

Basic usage:

```
const myFunction = new ContainerFunction(this, 'ContainerFunction', {initialPass: true});
```

Note that props are optional and this construct defaults to:
 * 1024M memory
 * 30s timeout
 * Runtime of Node, or Python if using `ZipFunction.python()`
 * Handler `src/lambda.handler`
 * Two year log retention
 * Creating an `EcrRepository` (accessible via the `repository` property of the construct)
 * The function description is set to the same value as the construct id to provide a human-friendly display in the AWS console listing

It's important to understand that you can only create a `DockerImageFunction` that points to an image that already exists (e.g. in ECR) so sometimes it's necessary to build in two 'passes'. The initial pass will point the Lambda to a placeholder image, using `DockerImageCode.fromImageAsset(...)`. Once your `EcrRepository` is built and populated you can then update the code to link the function to your image.

You can customise the component via the `ContainerFunctionProps` parameter, which gives you access to typical values you would want to change. If you need finer control, `ContainerFunctionProps.dockerImageFunctionProps` gived you full access to the CDK `DockerImageFunctionProps`.

### S3 buckets

These constructs allow you to create s3 buckets. You mostly don't need to use these directly, but if you do they enabel you to create standardised bucket configurations. They're used in a number of the patterns below. This secion documents them so you can understand how the patterns are put together.

#### PrivateBucket

A private s3 bucket - not accessible unless expliitly granted.

This construct defaults to:
 * `BlockPublicAccess.BLOCK_ALL`
 * `BucketEncryption.S3_MANAGED`
 * `RemovalPolicy.DESTROY`

 It may seem counterintuitive to have `RemovalPolicy.DESTROY`. This is done on the basis that if there are objects in the bucket, deletion will fail and, if the bucket is empty, we'd likely prefer to clean it up than leave it orphaned and potentially clutter our AWS account with disowned buckets (e.g. if repeatedly testing deployment and deletion of a stack).

This construct provides two static methods that vary the configuration above:
 * `PrivateBucket.expendable`: sets `autoDeleteObjects: true` and `removalPolicy: RemovalPolicy.DESTROY`
 * `PrivateBucket.retained`: sets `autoDeleteObjects: false` and `removalPolicy: RemovalPolicy.RETAIN`

#### KmsBucket

A private s3 bucket that uses KMS key encryprion. Note that a KMS key incurs a monthly coct of $1 plus a cost for each encryption/decryption after 20,000 free tier requests (at the time of writing).

This construct generates a `Key` (accessible via the `KmsBucket.key` property) and is not accessible unless explicitly granted.

This construct defaults to:
 * `BlockPublicAccess.BLOCK_ALL`
 * `BucketEncryption.KMS`
 * `bucketKeyEnabled: false`
 * `RemovalPolicy.RETAIN`
 * The key alias for the generated key defaults to `<stackName>/<id>` unless an explicit alias value is passed in the props. If you don't want a key alias, you can explicitly pass `null`.

#### BuildsBucket

This construct is intended to be used with `ZipFunction` as a singleton so its id defaults to 'builds'. It extends `PrivateBucket`.

When building your Lambda function code (e.g. in GitHub Actions) upload the output zip file to this bucket. This enables you to have clarity about the code that your functions are running and, if you update or change the ID of a function, when it's recreated by Cloudformation, it will be linked to the correct code.

If you push code directly to the function from CI/CD without going via a bucket then a function that's recreated by Cloudformation will be instantiated with placeholder code and will therefore not be able to execute until you run a CI/CD build that updates the code of the function.

This isn't necessarily an issue, depending on your use case, however if you are using Lambda to handle HTTP requests then your service would go down until your next build.

To link a Lambda to the build bucket, configure your `ZipFunction` instances as follows in your CDK code:

```
const builds = new BuildsBucket(this);

...

const myFunction = ZipFunction.node(this, 'myFunction', {
  ...
  functionProps: {
    code: Code.fromBucket(builds, 'myFunction.zip'),
    ...
  },
});
```

### Lambda patterns

The following constructs provide for key Lambda use-cases and allow you to assemble the majority of an event-driven service.

#### `BucketFunction`

 A Lambda function triggered by an event from an S3 bucket.

Creates a `PrivateBucket` and associates a Lambda function (typically `ZipFunction` or `ContainerFunction`) triggered when an object is created:

```
const uploadHandler = BucketFunction.node(this, 'uploadHandler');
uploadHandler.bucket; // The triggering bucket
uploadHandler.lambda; // The function which will receive the event
```

Additional static methods `BucketFunction.python(...)` and `BucketFunction.container(...)` are available. You can also instantiate the construct directly:

```
const myLambda: Function = ...
const uploadHandler = new BucketFunction(this, 'uploadHandler', {lambda: myLambda})
```

You can optionally configure an `EventType` array to respond to events other than `EventType.OBJECT_CREATED` and pass `ZipFunctionProps`/`ContainerFunctionProps` and/or a partial `BucketProps` to modify the configuration:

```
const functionProps: ZipFunctionProps = {...};
const events: EventType[] = [EventType.OBJECT_CREATED, EventType.OBJECT_REMOVED];
const bucketProps: Partial<BucketProps> = {};
const bucketHandler = BucketFunction.python(this, 'bucketHandler',  functionProps, events, bucketProps);
```

#### `QueueFunction`

A Lambda function triggered by messages from an SQS queue.

Creates a `Queue` and associates a Lambda function (typically `ZipFunction` or `ContainerFunction`) triggered when messages are sent to the queue:

```
const messageHandler = QueueFunction.node(this, 'messageHandler');
messageHandler.queue; // The triggering queue
messageHandler.lambda; // The function which will receive the event
```

Additional static methods `QueueFunction.python(...)` and `QueueFunction.container(...)` are available. You can also instantiate the construct directly:

```
const myLambda: Function = ...
const queueHandler = new QueueFunction(this, 'queueHandler', {lambda: myLambda})
```

You can optionally pass `ZipFunctionProps`/`ContainerFunctionProps` and/or a partial `QueueProps` to modify the configuration:

```
const functionProps: ZipFunctionProps = {...};
const queueProps?: Partial<QueueProps> = {...};
const queueHandler = QueueFunction.python(this, 'queueHandler',  functionProps, functionProps, queueProps);
```

#### `ScheduledFunction`

A Lambda function triggered by a Cloudwatch rule.

The default schedule is `Schedule.cron({ minute: '11', hour: '1' })`, which sets `'11 1 * * ? *'` (i.e. 1:11am every day)

Creates a `Rule` and associates a Lambda function (typically `ZipFunction` or `ContainerFunction`) triggered on a schedule:

```
const scheduledHandler = ScheduledFunction.node(this, 'scheduledHandler');
scheduledHandler.rule; // The triggering rule
scheduledHandler.lambda; // The function which will receive the event
```

Additional static methods `ScheduledFunction.python(...)` and `ScheduledFunction.container(...)` are available. You can also instantiate the construct directly:

```
const myLambda: Function = ...
const scheduledHandler = new ScheduledFunction(this, 'scheduledHandler', {lambda: myLambda})
```

You can optionally pass `ZipFunctionProps`/`ContainerFunctionProps` and/or a partial `QueueProps` to modify the configuration:

```
const functionProps: ZipFunctionProps = {...};
const schedule?: Schedule = Schedule.cron({ minute: '30', hour: '12' }),
const scheduledHandler = ScheduledFunction.python(this, 'scheduledHandler', functionProps, schedule);
```

### Additional patterns

These patterns are listed here for reference. They're not yet fully documented, however the source code and comments should provide guidace in the meantime:

#### Main patterns

* **WebFrontend** - A Cloudfront distribution backed by an s3 bucket. Useful for hosting a client-side application or static content.
* **WebApi** - A web API, backed by a single Lambda function and fronted by Cloudfront
* **WebApp** - A web application, backed by a single Lambda function and fronted by Cloudfront. This differs from `WebApi` in that it adds an s3 bucket for static content.
* **WebRoutes** - A web application, backed by a multiple Lambda functions and fronted by Cloudfront. This is similar to `WebApp` but allows you to parition your server-side code into separate Lambda functions.
* **Cognito** - A construct with a set of static functions to enable you to build Cognito use cases, including social login, email login and SSO login (e.g. for your corporate identity). This construct has good comments in the code to step you through the process. See the `withSocialLogins()`, `withEmailLogin()` and `withSSO()` functions to get started.
* **GithubActions** - Enables GithubActions to get keyless (OIDC) access to deploy updates to your stack. The constructs in this library will automatically make a note of components which GitHub Actions would potentially need access to. If you use this construct then limited access to these resources will be granted to GHA. THis construct has comments in the code and additional documentation on OIDC access is available on GitHub and from AWS. To get started, take a look at:
  * `const oidcProvider = githubActions(this).ghaOidcProvider();` - only one provider is needed per AWS account so you may prefer to configure this manually.
  * `githubActions(this).ghaOidcRole({ owner: 'my_username', repo: 'my_repo' });` - Sets up keyless access. You need to specify the owner whose repos will be granted access and, optionally, a single repo and if you wish, an additional filter.
  * If you need to explicittly add additional resources manually, see also `addGhaSecret`, `addGhaVariable`, `addGhaLambda`, `addGhaBucket`, `addGhaDistribution` and `addGhaRepository`.
  * This construct will output information that vcan be used by `@scloud/cdk-github` to automate setting GitHub repo/environment secrets and variables.

#### Component patterns

* **EcrRepository** - an ECR container image repository. This is used by `ContainerFunction` but you may want to use it directly as well.
* **RedirectDomain** - wraps `route53patterns.HttpsRedirect` to redirect a domain name, including `www.` from a `HostedZone.zoneName` to a target domain, on both `http` and `https`.
* **RedirectWww** - wraps `route53patterns.HttpsRedirect` to redirect `www.` from a `HostedZone.zoneName` (or subdomain) to te bare domain, on both `http` and `https`. For example www.example.com -> example.com or www.subdomain.example.com -> subdomain.example.com

#### Non-free patterns
* **SecretJson**/**SecretString** - wraps the `Secret` construct to make it easier to create JSON and string secrets. Note that secrets aren't free, they cost $0.40 per month at the time of writing.
* **PrivateEndpoint** - extends `InterfaceVpcEndpoint` to make it easy to generate private endpoints for s3, sqs, ecr, secrets manager and cloudwatch. Note that private endpoints aren't free, but if you need to locate a Lambda function in a vpc you may need one.
* **FargateService** - Builds on the CDK `ApplicationLoadBalancedFargateService` to enable you to deploy a web-facing container. This construct incurs cost to keep the container(s) running so it's not 'fully serverless' and as such is not actively maintained.


## Philosophy and contribution

I've refined these patterns since 2020 to keep them as clean, simple and useful as possible. My aim is to build a library that gives you what you usually need, most of the time. That means it makes assumptions and has some opinions.

Most of the constructs focus on Lambdas packaged as zip files. Container versions are also available but this code isn't touched as often so these may be less up to date.

If you need something that's more specific / more configurable and isn't catered for you can:

  * Use the source code of existing constructs as a starting point to develop your own CDK code that meets your use-case
  * Open an issue or send me a pull request if you see an opportunity for improvement

