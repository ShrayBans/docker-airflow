#!/usr/bin/env bash

set -e

npm version patch
PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')

# git tag v$PACKAGE_VERSION
git push --tags

$(aws ecr get-login --profile sixthman | sed 's/-e none//g')

docker build -t 146006631841.dkr.ecr.us-west-1.amazonaws.com/docker-airflow:$PACKAGE_VERSION .
docker push 146006631841.dkr.ecr.us-west-1.amazonaws.com/docker-airflow:$PACKAGE_VERSION

git commit -m "$PACKAGE_VERSION"
git push