#!/usr/bin/env bash
set -eu

rm -rf dist

yarn
yarn upgrade
yarn lint
yarn test
yarn package
yarn publish

echo "End: $(date)"
