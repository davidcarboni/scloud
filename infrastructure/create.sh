#!/usr/bin/env bash
set -eu

# Secrets
for i in $(ls ../secrets/*.sh); do
  echo " * $i"
  source $i
done

# AWS profile
if [ -z "$AWS_PROFILE" ]; then
  echo "Using default AWS profile"
else
  echo "Using AWS profile: $AWS_PROFILE"
fi

echo "Starting infrastructure build: $(date)"
npm run lint

# First ever deploy (and safe to call on subsequent deploys):
account=$(aws sts get-caller-identity --query Account --output text)
cdk bootstrap aws://${account}/eu-west-2 # UK Resources
cdk bootstrap aws://${account}/us-east-1 # Cloudfront resources

# Trigger CI builds by adding commits to the component directories
function gha_build {
  components=(
    static
    web
    metrics
    github
  )

  # Dispatch workflows
  for repository in "${components[@]}"
  do
    url=https://api.github.com/repos/company/project/actions/workflows/${repository}.yml/dispatches
    echo $url
    curl \
    -H "Authorization: token ${PERSONAL_ACCESS_TOKEN}" \
    -X POST \
    -H "Accept: application/vnd.github.v3+json" \
    $url \
    -d '{"ref":"main"}'
  done

  # Wait for builds to (hopefully) succeed
  # echo "Sleeping for 3 minutes... (`date`)" && sleep 60
  # echo "Sleeping for 2 minutes..." && sleep 60
  # echo "Sleeping for 1 more minute..." && sleep 60
}

# Infractructure build in 2 passes, with container builds in the middle:

# First-pass deploy
echo "Running deploy initial pass"
PASS=initial cdk deploy --all --outputs-file ../secrets/cdk-outputs.json --require-approval never

# Set initial secrets
npm run secrets

# Trigger builds to populate ECR repos
echo "Giving Github a few seconds..." && sleep 10
gha_build

# Full deploy
cdk deploy --all --outputs-file ../secrets/cdk-outputs.json --require-approval never

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
