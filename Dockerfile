# VERSION 1.10.0-2
# AUTHOR: Matthieu "Puckel_" Roisil
# DESCRIPTION: Basic Airflow container
# BUILD: docker build --rm -t puckel/docker-airflow .
# SOURCE: https://github.com/puckel/docker-airflow

FROM python:3.6-slim
LABEL maintainer="ShrayBans"

# Never prompts the user for choices on installation/configuration of packages
ENV DEBIAN_FRONTEND noninteractive
ENV TERM linux

# Airflow
ARG AIRFLOW_VERSION=1.10.0
ARG AIRFLOW_HOME=/usr/local/airflow
ENV AIRFLOW_GPL_UNIDECODE yes

# Define en_US.
ENV LANGUAGE en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LC_ALL en_US.UTF-8
ENV LC_CTYPE en_US.UTF-8
ENV LC_MESSAGES en_US.UTF-8

RUN set -ex \
        && buildDeps=' \
        python3-dev \
        libkrb5-dev \
        libsasl2-dev \
        libssl-dev \
        libffi-dev \
        libblas-dev \
        liblapack-dev \
        libpq-dev \
        git \
        ' \
        && apt-get update -yqq \
        && apt-get upgrade -yqq \
        && apt-get install -yqq --no-install-recommends \
        $buildDeps \
        build-essential \
        python3-pip \
        python3-requests \
        mysql-client \
        mysql-server \
        default-libmysqlclient-dev \
        apt-utils \
        curl \
        rsync \
        netcat \
        locales \
        && sed -i 's/^# en_US.UTF-8 UTF-8$/en_US.UTF-8 UTF-8/g' /etc/locale.gen \
        && locale-gen \
        && update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
        && useradd -ms /bin/bash -d ${AIRFLOW_HOME} airflow \
        && pip install -U pip setuptools wheel \
        && pip install Cython \
        && pip install pytz \
        && pip install pyOpenSSL \
        && pip install ndg-httpsclient \
        && pip install pyasn1 \
        && pip install apache-airflow[crypto,celery,postgres,hive,jdbc,mysql]==$AIRFLOW_VERSION \
        && pip install 'celery[redis]>=4.1.1,<4.2.0' \
        && apt-get purge --auto-remove -yqq $buildDeps \
        && apt-get autoremove -yqq --purge \
        && apt-get clean \
        && rm -rf \
        /var/lib/apt/lists/* \
        /tmp/* \
        /var/tmp/* \
        /usr/share/man \
        /usr/share/doc \
        /usr/share/doc-base

COPY script/entrypoint.sh /entrypoint.sh
COPY config/airflow.cfg ${AIRFLOW_HOME}/airflow.cfg
COPY package.json ${AIRFLOW_HOME}/package.json



########### Edited by Shray
# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Install base dependencies
RUN apt-get update && apt-get install -y -q --no-install-recommends \
        apt-transport-https \
        build-essential \
        ca-certificates \
        curl \
        git \
        libssl-dev \
        wget

ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 8.11.3



WORKDIR $NVM_DIR

RUN curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash \
        && . $NVM_DIR/nvm.sh \
        && nvm install $NODE_VERSION \
        && nvm alias default $NODE_VERSION \
        && nvm use default

ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

WORKDIR ${AIRFLOW_HOME}
RUN npm install -g yarn
RUN yarn install
RUN yarn global add typescript

RUN pip3 install boto3==1.8.0 \
        && pip3 install botocore==1.11.0 \
        && pip3 install py4j==0.10.6 \
        && pip3 install python-dateutil==2.6.1 \
        && pip3 install requests==2.18.4 \
        && pip3 install s3transfer==0.1.13 \
        && pip3 install urllib3==1.22 \
        && pip3 install psycopg2 \
        && pip3 install pyyaml \
        && pip3 install pandas

ENV POSTGRES_HOST sixthman-prod.cbdmxavtswxu.us-west-1.rds.amazonaws.com
ENV POSTGRES_PORT 5432
ENV POSTGRES_USER sixthman
ENV POSTGRES_PASSWORD lebrunsux123
ENV POSTGRES_DB airflow

########### Edited by Shray

RUN chown -R airflow: ${AIRFLOW_HOME}

EXPOSE 8080 5555 8793

USER airflow
WORKDIR ${AIRFLOW_HOME}
ENTRYPOINT ["/entrypoint.sh"]
CMD ["webserver"] # set default arg for entrypoint