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
