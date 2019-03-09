#!/usr/bin/env bash

set -e

if [ -z "$1" ]; then
    echo "Please provide a remote server to rsync to"
    exit 1
fi
REMOTE_SERVER=$1

sh rsync-to-remote.sh $REMOTE_SERVER

ssh $REMOTE_SERVER << EOF
    cd docker-airflow
    docker-compose -f docker-compose-consumer.yml down
    docker-compose -f docker-compose-consumer.yml up -d
EOF