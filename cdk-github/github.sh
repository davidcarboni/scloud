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

# Update secrets
echo "Setting Github secrets"
npx cdk-github-secrets "$@"

echo "End: $(date)"
