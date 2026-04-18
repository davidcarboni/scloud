#!/usr/bin/env bash
set -e
root=$(pwd)

# Global dependencies
npm i -g \
  npm \
  typescript \
  tsx \
  aws-cdk \
  --

# Lambdas
# see https://stackoverflow.com/a/4747961/723506
cd ${root}
for dir in $(find . -maxdepth 1 -mindepth 1 -type d)
do
  echo "Checking ${dir}..."
    if [ -f "${root}/${dir}/package.json" ]; then
      echo "Upgrading ${dir}..."
      cd ${root}/$dir
      rm -rf package-lock.json node_modules
      npm install
    else
      echo "Skipping ${dir}..."
    fi
done
cd ${root}
