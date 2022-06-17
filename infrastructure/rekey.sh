#!/usr/bin/env bash
set -eu

# Secrets, including selected AWS profile:
for i in $(ls ../secrets/*.sh); do
  echo " - $i"
  source $i
done
if [ -f '../secrets/aws.sh' ]; then
  echo "Using AWS profile: $AWS_PROFILE"
else
  echo "Using default AWS profile"
fi

npm run lint
REKEY=true cdk deploy
cdk deploy --outputs-file ../secrets/cdk-outputs.json
npm run secrets
