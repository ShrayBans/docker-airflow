#!/usr/bin/env bash

set -e

if [ -z "$1" ]; then
    echo "Please provide a docker file to roll to"
    exit 1
fi
DOCKER_COMPOSE_FILE=$1

yarn build
docker-compose -f $DOCKER_COMPOSE_FILE down
docker-compose -f $DOCKER_COMPOSE_FILE up -d
docker-compose -f $DOCKER_COMPOSE_FILE logs -f
sleep 200