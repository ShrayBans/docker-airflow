#!/usr/bin/env bash

set -e

if [ -z "$1" ]; then
    echo "Please provide a remote server to rsync to"
    exit 1
fi
REMOTE_SERVER=$1

# rsync -azvh docker-airflow $REMOTE_SERVER:docker-airflow # Only use to instantiate
rsync -azvh dags $REMOTE_SERVER:docker-airflow/dags
rsync -azvh config $REMOTE_SERVER:docker-airflow/config
rsync -azvh src $REMOTE_SERVER:docker-airflow/src
rsync -azvh docker-compose-prod.yml $REMOTE_SERVER:docker-compose-prod.yml