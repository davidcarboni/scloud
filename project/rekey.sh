#!/usr/bin/env bash
set -eu
export AWS_PROFILE=carboni

source ../secrets/google.sh
source ../secrets/facebook.sh
source ../secrets/github.sh
source ../secrets/slack.sh

npm run lint
REKEY=true cdk deploy
cdk deploy --outputs-file ../secrets/cdk-outputs.json
npm run secrets
