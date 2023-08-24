#!/usr/bin/env bash
set -eu

# Secrets, including selected AWS profile:
for i in $(ls secrets/*.sh); do
  echo " * $i"
  source $i
done

# AWS profile
if [ -f 'secrets/aws.sh' ]; then
  echo "Using AWS profile: $AWS_PROFILE"
else
  echo "Using default AWS profile"
fi

echo "Starting infrastructure build: $(date)"
# cdk bootstrap

# Lint
npm run lint

# Show differences
cdk diff

read -p "Do you want to proceed? (y/N) " yn
case $yn in
 	y ) echo Deploying...;;
 	* ) echo Exit;
 		exit 0;;
esac

# Skip approval on the basis we've already done a diff above so this creates a repeat y/n prompt:
cdk deploy --all --require-approval never --outputs-file ./secrets/cdk-outputs.json

# Update secrets
echo "Setting Github secrets"
npm run secrets

# Build an environment file for Docker Compose to run locally
# echo "Writing Docker Compose environment file"
# npm run compose
# git commit -m "Infrastructure build" ../docker-compose.env

# Store the names of the ECR repos
# Because they're different every time the inferastructure is rebuilt and we'll need them to run delete.sh
# npm run ecr-repos

echo "End: $(date)"
