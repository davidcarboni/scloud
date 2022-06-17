#!/usr/bin/env bash
set -eu

# Secrets
for i in $(ls ../secrets/*.sh); do
  echo " - $i"
  source $i
done

# AWS profile
if [ -f '../secrets/aws.sh' ]; then
  echo "Using AWS profile: $AWS_PROFILE"
else
  echo "Using default AWS profile"
fi

# Delete ECR images
for repository in "${repositories[@]}"
do
    FOUND_IMAGES=$( aws ecr list-images --repository-name $repository --query 'imageIds[*]' --output text  || true )
    if [ ! -z "$FOUND_IMAGES" ]
    then
        echo "Deleting all images from $repository:"
        IMAGES_TO_DELETE=$( aws ecr list-images --repository-name $repository --query 'imageIds[*]' --output json)
        aws ecr batch-delete-image --region eu-west-2 --repository-name $repository --image-ids "$IMAGES_TO_DELETE"
    else
        echo "$repository is clear of images."
    fi
done

# Delete the stack
# echo "Preparing to delete..."
# PASS=delete cdk deploy --all --require-approval never
echo "Deleting stack..."
aws cloudformation delete-stack --stack-name projectStack
echo "Waiting for delete to complete..."
aws cloudformation wait stack-delete-complete --stack-name projectStack || \
echo "retrying delete..." && \
aws cloudformation delete-stack --stack-name projectStack && \
aws cloudformation wait stack-delete-complete --stack-name projectStack && \
echo "Delete succeeded on second round."
echo "The End."
