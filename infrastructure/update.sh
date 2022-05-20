#!/usr/bin/env bash
set -eu

# We need to set secrets in the environment before we can bootstrap or deploy:
source ../secrets/aws.sh
source ../secrets/google.sh
source ../secrets/facebook.sh
source ../secrets/github.sh
source ../secrets/slack.sh

echo "Starting infrastructure build: $(date)"
npm run lint

# Full deploy
cdk deploy --all --outputs-file ../secrets/cdk-outputs.json

# Update secrets
echo "Setting Github secrets"
npm run secrets

# Build an environment file for Docker Compose to run locally
echo "Writing Docker Compose environment file"
npm run compose
git commit -m "Infrastructure build" ../docker-compose.env

# Store the names of the ECR repos
# Because they're different every time the inferastructure is rebuilt and we'll need them to run delete.sh
npm run ecr-repos

echo "End: $(date)"
