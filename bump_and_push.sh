#!/usr/bin/env bash

npm version patch
PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')

git tag v$PACKAGE_VERSION
git push --tags

git commit -m "$PACKAGE_VERSION"

docker build -t 146006631841.dkr.ecr.us-west-1.amazonaws.com/docker-airflow:$PACKAGE_VERSION .
docker push 146006631841.dkr.ecr.us-west-1.amazonaws.com/docker-airflow:$PACKAGE_VERSION

