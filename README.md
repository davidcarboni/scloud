# scloud

_AWS CDK patterns for assembling serverless infrastructures_

If you're not massively interested in infrastructure, but want to do it well, without making it your mission in life then scloud could be what you need.

It's bunch of things done well that you can benefit from. I use it to store chunks of reference code I use each time I build a new service.

## Serverless CDK infrastructure

The folder you're likely looking for is: https://github.com/davidcarboni/scloud/tree/main/cdk-patterns/src

This repo contains a set of AWS CDK patterns packaged as functions so you can put serverless architectures together with a few function calls. The aim is to make it easy to put together typical infrastructure building blocks that can be reused (and/or tweaked) across projects.

The name 'scloud' means 'simple cloud', but could equally mean other things. These patterns are designed to be basic and not finely configurable, on the basis that keeping things standad, simple, even a bit stupid (you can decide for yourself what the S in Scloud stands for) is a good way to get things done and get on with life.

## Github secrets and variables

The other folder you'll want to look in is: https://github.com/davidcarboni/scloud/tree/main/cdk-github/src

If you use Github Actions, chances are you'll want to pass variables and secrets from your infrasturcture build to your Github Actions workflows, for example generated bucket and Lambda names. Once you're set up, you can use `npm run secrets` to read in values output by CDK deploy and use them to set up secrets and variables on Github automatically.

## Infrastructure setup and utilities

There are a bunch of example scripts and setup under https://github.com/davidcarboni/scloud/tree/main/infrastructure

A couple of key files are `dependencies.sh` (changes you may want to make to package.json) and `update.sh` (a usedul CDK deployment script). You'll also want to look at the `/secrets` directory - this is where you'll want to create `*.sh` files that can be sourced by `update.sh` to supply values to your infrastructure build.
