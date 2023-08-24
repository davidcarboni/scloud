#!/usr/bin/env bash

cdk init app --language typescript

npm i --save-dev \
  @types/node \
  @types/aws-lambda \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  @types/libsodium-wrappers \
  @types/lodash \
  @types/source-map-support \
  eslint \
  eslint-config-airbnb-base  \
  eslint-plugin-import \
  eslint-import-resolver-typescript \
  --
npm i \
  @octokit/rest \
  libsodium-wrappers \
  aws-lambda \
  lodash \
  libsodium-wrappers \
  scloud/cdk-github \
  scloud/cdk-patterns
  --

#
# package.json:
#
#   "scripts": {
#    ...,
#    "lint": "eslint --fix --ext ts bin lib",
#    "secrets": "ts-node lib/github.ts"
#
# find (regex): "\^?~?\d{1,3}\.\d{1,3}\.\d{1,3}"
# replace: "*" (except package version)
#
