#!/usr/bin/env bash
set -eu

source ../secrets/aws.sh
source ../secrets/google.sh
source ../secrets/facebook.sh
source ../secrets/slack.sh
source ../secrets/ecr-repos.sh

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
