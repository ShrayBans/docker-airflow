#!/usr/bin/env bash

set -e

if [ -z "$1" ]; then
    echo "Please provide a remote server to rsync to"
    exit 1
fi
REMOTE_SERVER=$1

yarn build

# rsync -azvh docker-airflow $REMOTE_SERVER:docker-airflow # Only use to instantiate
rsync -azvh dags $REMOTE_SERVER:docker-airflow/
rsync -azvh build $REMOTE_SERVER:docker-airflow/
rsync -azvh src $REMOTE_SERVER:docker-airflow/
rsync -azvh node_modules $REMOTE_SERVER:docker-airflow/
rsync -azvh docker-compose-prod.yml $REMOTE_SERVER:docker-airflow/
rsync -azvh docker-compose-consumer.yml $REMOTE_SERVER:docker-airflow/