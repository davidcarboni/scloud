#!/usr/bin/env bash
set -eu

rm -rf js dist

yarn
yarn upgrade
yarn lint
yarn test
yarn compile
yarn package
yarn publish --access public

echo "End: $(date)"
