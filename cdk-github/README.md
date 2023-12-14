# CDK Github secrets and variables

This is a companion package designed to work with `@scloud/cdk-patterns`:` https://www.npmjs.com/package/@scloud/cdk-patterns

Takes outputs produced by the `githubActions().ghaOidcRole()` and `githubActions().ghaUser()` features of `@scloud/cdk-patterns` and automates setting repo/environment secrets and variables in Github Actions.

This is intended to provide you with the environment/variable/secret handling capabilities you'll mostly need. If you have an edge-case, the repo serves as example code you can reuse to help you get what you need done more easily.

## Setup

Assuming you've called the `ghaOidcRole` or `ghaUser` function, you should have some output files under your `.infrastructure/secrets` directory, e.g.:

 * `.infrastructure/secrets/StackName.ghaSecrets.json`
 * `.infrastructure/secrets/StackName.ghaVariables.json`

`@scloud/cdk-github` uses these files as inputs to understand the values that need to be set on the repo (or its environments) and whether or not the value needs to be handled as a secret.

## Running

To set variables and/or secrets, you can use the following example code:

```
import { updateGithub } from '@scloud/cdk-github';

(async () => {
  await updateGithub();
})();
```

The key part is the call to the `updateGithub` function.

You can optionally pass `true` to this function if you would like this process to delete any "leftover" (orphaned) values. This removes secrets and variables if they are no longer specified by the stack. However, be aware tht this will delete any variables you've set manually! Passing `true` is recommended to fully automate and keep the set of variables and secrets clean.

You will also need the following environment variables, or pass an object with these values when you call the function:

```
export USERNAME=octocat
export PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxx
export OWNER=organization
export REPO=repository
```

or

```
{
  username: 'octocat',
  personalAccessToken: 'ghp_xxxxxxxxxxx',
  owner: 'organization',
  repo: 'repository',
}
```