# CDK Github secrets and variables

This is a companion package designed to work with `@scloud/cdk-patterns`:` https://www.npmjs.com/package/@scloud/cdk-patterns

Takes outputs produced by the `githubActions().ghaOidcRole()` and `githubActions().ghaUser()` features of `@scloud/cdk-patterns` and automates setting repo/environment secrets and variables in Github Actions.

This is intended to provide you with the environment/variable/secret handling capabilities you'll mostly need. If you have an edge-case, the repo serves as example code you can reuse to help you get what you need done more easily.

## Release notes

 * **0.4.0**: Add `cdk-github` CLI (`dist/cli.js`); library entry is `updateGithub` from the package root
 * **0.3.2**: Update build process to improve package structure
 * **0.3.0**: Restructure so consumers don't need to include `/dist` in import paths

## Setup

Assuming you've called the `ghaOidcRole` or `ghaUser` function, you should have some output files under your `.infrastructure/cdk.out` directory, e.g.:

 * `.infrastructure/cdk.out/StackName.ghaSecrets.json`
 * `.infrastructure/cdk.out/StackName.ghaVariables.json`

`@scloud/cdk-github` uses these files as inputs to understand the values that need to be set on the repo (or its environments) and whether or not the value needs to be handled as a secret.

## Running

From your `.infrastructure` directory (after `cdk deploy` has written `cdk.out/cdk-outputs.json`):

```bash
cdk-github --delete
```

Pass `--delete` to remove orphaned repo/environment secrets and variables that are no longer specified by the stack. Omit it to leave manually-added values in place.

Set credentials via environment variables (e.g. from `secrets/github.sh`):

```
export USERNAME=octocat
export PERSONAL_ACCESS_TOKEN=github_ghp_xxxxxxxxxxx
export OWNER=organization
export REPO=repository
```

You can also call the library from code:

```
import { updateGithub } from '@scloud/cdk-github';

await updateGithub(true);
```

The key part is the call to `updateGithub`, or the `cdk-github` CLI equivalent.