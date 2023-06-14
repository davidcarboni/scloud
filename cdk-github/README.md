# CDK Github secrets and variables

Takes outputs produced by the `ghaUser` feature of `@scloud/cdk-patterns` and automates setting repo/environment secrets and variables for Github Actions.

## Setup

Assubing you've called the `ghaUser` function, you should have some output fikes under your `infrastructure/secrets` directory, e.g.:

 * `infrastructure/secrets/StackName.ghaSecrets.json`
 * `infrastructure/secrets/StackName.ghaVariables.json`

`@scloud/cdk-github` uses these files as inputs to understand the values that need to be set on the repo (or environment) and whether the value needs to be handled as a secret or not.

## Running

To set variables and/or secrets, you can use the following example code:

```
import { updateGithub } from '@scloud/cdk-github';

(async () => {
  await updateGithub();
})();
```

The key part is the call to the `updateGithub` function. You can optionally pass `true` to this function if you would like this process to delete any "leftover" (or orphaned) values. This removes secrets and variables if they are no longer specified by the stack. However, be aware tht this will also delete any variables you've set manually! This is because any variable or secret not specified by the stack will be removed.
