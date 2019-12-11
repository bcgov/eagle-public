# Environmental Assessment Office

## Maintenance Mode

### Usage

Caddy pods serving static html are deployed to our prod environment. To enable maintenance mode switch the routes between the eao-public and eao-proxy-caddy services.  A namespace (project) for deployment must be specified.

Expected namespaces:

* esm-prod

For the sake of simplicity all examples will use esm-prod and be run on OS X.

1. ##### Enable/Disable by Script

    Maintenance mode on.

    ```
    ./maintenance.sh esm-prod on
    ```

    Maintenance mode off.

    ```
    ./maintenance.sh esm-prod off
    ```

2. ##### Enable/Disable by Command line

    Maintenance mode on.

    ```
    oc patch route www-esm-prod -n esm-prod -p \
        '{ "spec": { "to": { "name": "eao-proxy-caddy", "port": { "targetPort": "2015-tcp" }}}'
    oc patch route eao-proxy-caddy -n esm-prod -p \
        '{ "spec": { "to": { "name": "eao-public" }, "port": { "targetPort": "8080-tcp" }}}'
    ```

    Maintenance mode off.

    ```
    oc patch route www-esm-prod -n esm-prod -p \
        '{ "spec": { "to": { "name": "rproxy", "port": { "targetPort": "8080-tcp" }}}'
    oc patch route eao-proxy-caddy -n esm-prod -p \
        '{ "spec": { "to": { "name": "eao-proxy-caddy" }, "port": { "targetPort": "2015-tcp" }}}'
    ```

3. ##### Enable/Disable by OpenShift GUI Console

    a. Navigate to [OpenShift Container Platform Console](https://console.pathfinder.gov.bc.ca:8443/console/)
    - [esm-test](https://console.pathfinder.gov.bc.ca:8443/console/project/esm-test/browse/routes)
    - [esm-prod](https://console.pathfinder.gov.bc.ca:8443/console/project/esm-prod/browse/routes)

    b. Edit the route called `www-esm-prod` and make it point to the `eao-proxy-caddy` service instead of `rproxy`
    - [esm-prod](https://console.pathfinder.gov.bc.ca:8443/console/project/esm-prod/edit/routes/www-esm-prod)

    c. Confirm that the Maintenance screen is up
    - [esm-prod](https://www.projects.eao.gov.bc.ca)

    Maintenance mode off.

    a. Navigate to [OpenShift Container Platform Console](https://console.pathfinder.gov.bc.ca:8443/console/)
    - [esm-test](https://console.pathfinder.gov.bc.ca:8443/console/project/esm-test/browse/routes)
    - [esm-prod](https://console.pathfinder.gov.bc.ca:8443/console/project/esm-prod/browse/routes)

    b. Edit the route called `www-esm-prod` and make it point to the `rproxy` service instead of `eao-proxy-caddy`
    - [esm-prod](https://console.pathfinder.gov.bc.ca:8443/console/project/esm-prod/edit/routes/www-esm-prod)

    c. Confirm that the Maintenance screen is up
    - [esm-prod](https://www.projects.eao.gov.bc.ca)

### Build and Deployment

This application's template has been broken down into build and deploy components.

##### Build

Template:

* ../templates/caddy.bc.json

Contains:

* ImageStream
* BuildConfig

Default vars:

* NAME: eao-proxy-caddy
* IMG_SRC: bcgov-s2i-caddy
* GIT_REPO: https://github.com/bcgov/eao-public.git
* GIT_BRANCH: dev

Build Project:

* esm


1. ##### Build by Script

    ```
    ./maintenance.sh esm build
    ```

2. ##### Build by Command line

    ```
    oc process -f ../templates/caddy.bc.json -p NAME=eao-proxy-caddy \
      GIT_REPO=https://github.com/bcgov/eao-public.git GIT_BRANCH=dev \
      IMG_SRC=bcgov-s2i-caddy | oc apply -f -

    ```

##### Deploy

Template:

* ../templates/caddy.dc.json

Contains:

* DeploymentConfig
* Service

Default vars:

* NAME: eao-proxy-caddy
* BUILD_PROJECT: [specified namespace]

Build (Source) Project:

* [specified namespace]

Deploy Projects Available:

* esm-test
* esm-prod
* esm-dev


1. ##### Deploy by Script (must be built in the same namespace)

    ```
    ./maintenance.sh esm-test deploy
    ```

2. ##### Deploy by Command line

    ```
    oc process -f ../templates/caddy.bc.json -n esm-prod -p NAME=eao-proxy-caddy \
        BUILD_PROJECT=esm-test | oc apply -f -
    oc expose svc proxy-caddy
    ```

##### Deploy from Tools

Template:

* ../templates/caddy.dc.json

Contains:

* DeploymentConfig
* Service

Default vars:

* NAME: eao-proxy-caddy
* BUILD_PROJECT: esm

Build (Source) Project:

* esm

Deploy Projects Available:

* esm-test
* esm-prod
* esm-dev


1. ##### Deploy by Script to Desired Namespace From Tools

    ```
    ./maintenance.sh esm-prod deploy-from-tools
    ```

2. ##### Deploy by Command line

    ```
    oc process -f ../openshift/templates/caddy.bc.json -n esm-prod -p NAME=eao-proxy-caddy \
        BUILD_PROJECT=esm | oc apply -f -
    oc expose svc eao-proxy-caddy
    ```

### Initial Setup

Starting from scratch the above steps will be reordered (building in tools namespace (esm) is the pattern we use):

1. Build in tools namespace (eg. esm)
2. Deploy (deplly-from-tools) in desired namespace (eg. esm-prod)
3. Maintenance on
4. Maintenance off
