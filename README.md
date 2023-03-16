# scloud

_AWS CDK patterns for assembling serverless infrastructures_

If you're not intimately interested in infrastructure, want to do it well, but don't want to make it your passion in life then scloud could be what you need.

I use it to store chunks of reference code I use again and again, each time I build a new service.

## Serverless CDK infrastructure

The folder you're likely looking for is: https://github.com/davidcarboni/scloud/tree/main/infrastructure/src/scloud

This repo contains a set of AWS CDK patterns packaged as functions so you can put serverless architectures together with a few function calls.

The aim is to make it easy to put together typical infrastructure building blocks that can be reused (and/or tweaked) across projects.

The name 'scloud' means 'simple cloud', but could equally mean other things. These patterns are designed to be basic and not finely configurable, on the basis that keeping things standad, simple, even a bit stupid (take that as far into the S territory as you like) is a good way to get things done and get on with life.

## Github secrets and variables

The other folder you'll want to look for is: https://github.com/davidcarboni/scloud/tree/main/infrastructure/src/github

If you use Github Actions, chances are you'll want to pass variables and secrets from your infrasturcture build to your Github Actions workflows, for example generated bucket and Lambda names. Once you're set up, you can use `npm run secrets` to read in values output by CDK deploy and use them to set up secrets and variables on Github automatically.
