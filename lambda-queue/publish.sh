#!/usr/bin/env bash
set -eu

rm -rf js dist

yarn
yarn upgrade
yarn lint
yarn test
yarn compile
yarn package
yarn publish

echo "End: $(date)"
