#!/bin/bash


# Halt on errors/unsets, change fail returns, change field separator
#
set -euo pipefail
IFS=$'\n\t'


# Parameters and mode variables
#
PROJECT=${1:-}
COMMAND=${2:-}
VERBOSE=${VERBOSE:-}


# App and build settings
#
APPLICATION_NAME=${APPLICATION_NAME:-eao-public}
APPLICATION_PROXY_NAME=${APPLICATION_PROXY_NAME:-rproxy}
APPLICATION_ROUTE_NAME=${APPLICATION_ROUTE_NAME:-www-esm-prod}
APPLICATION_PORT=${APPLICATION_PORT:-8080-tcp}
APPLICATION_PROXY_PORT=${APPLICATION_PROXY_PORT:-8080-tcp}

STATIC_PAGE_NAME=${STATIC_PAGE_NAME:-eao-proxy-caddy}
STATIC_PAGE_ROUTE_NAME=${STATIC_PAGE_ROUTE_NAME:-eao-proxy-caddy}
STATIC_PAGE_PORT=${STATIC_PAGE_PORT:-2015-tcp}

TOOLS_PROJECT=${TOOLS_PROJECT:-esm}
#
IMG_SRC=${IMG_SRC:-bcgov-s2i-caddy}
GIT_REPO=${GIT_REPO:-https://github.com/bcgov/eao-public.git}
GIT_BRANCH=${GIT_BRANCH:-dev}
OC_BUILD=${OC_BUILD:-../templates/caddy.bc.json}
OC_DEPLOY=${OC_DEPLOY:-../templates/caddy.dc.json}



# Verbose option
#
[ "${VERBOSE}" == true ]&& \
	set -x


# Show message if passed any params
#
if [ "${#}" -lt 2 ]
then
	echo
	echo "Maintenace Mode: Caddy served static page"
	echo
	echo "Provide a project and a command."
	echo " './maintenance.sh <project_name> <on|off|build|deploy|deploy-from-tools>'"
	echo
	echo "Set variables to non-defaults at runtime.  E.g.:"
	echo " 'VERBOSE=true GIT_BRANCH=dev ./maintenance.sh <...>'"
	echo
	exit
fi


# Check project
#
CHECK=$( oc projects | tr -d '*' | grep -v "Using project" | grep "${PROJECT}" | awk '{ print $1 }' || echo )
if [ "${PROJECT}" != "${CHECK}" ]
then
	echo
	echo "Unable to access project ${PROJECT}"
	echo
	exit
fi


# Action based on parameter
#
if [ "${COMMAND}" == "on" ]
then
	oc patch route ${APPLICATION_ROUTE_NAME} -n ${PROJECT} -p \
		'{ "spec": { "to": { "name": "'$( echo ${STATIC_PAGE_NAME} )'" },
		"port": { "targetPort": "'$( echo ${STATIC_PAGE_PORT} )'" }}}'
	oc patch route ${STATIC_PAGE_ROUTE_NAME} -n ${PROJECT} -p \
		'{ "spec": { "to": { "name": "'$( echo ${APPLICATION_NAME} )'" },
		"port": { "targetPort": "'$( echo ${APPLICATION_PORT} )'" }}}'
elif [ "${COMMAND}" == "off" ]
then
	oc patch route ${APPLICATION_ROUTE_NAME} -n ${PROJECT} -p \
		'{ "spec": { "to": { "name": "'$( echo ${APPLICATION_PROXY_NAME} )'" },
		"port": { "targetPort": "'$( echo ${APPLICATION_PROXY_PORT} )'" }}}'
	oc patch route ${STATIC_PAGE_ROUTE_NAME} -n ${PROJECT} -p \
		'{ "spec": { "to": { "name": "'$( echo ${STATIC_PAGE_NAME} )'" },
		"port": { "targetPort": "'$( echo ${STATIC_PAGE_PORT} )'" }}}'
elif [ "${COMMAND}" == "build" ]
then
	oc process -f ${OC_BUILD} \
		-p NAME=${STATIC_PAGE_NAME} GIT_REPO=${GIT_REPO} GIT_BRANCH=${GIT_BRANCH} IMG_SRC=${IMG_SRC} \
		| oc apply -f -
elif [ "${COMMAND}" == "deploy" ]
then
	oc process -f ${OC_DEPLOY} -n ${PROJECT} -p NAME=${STATIC_PAGE_NAME} BUILD_PROJECT=${PROJECT} \
		| oc apply -f -
	oc get route ${STATIC_PAGE_NAME} || \
		oc expose svc ${STATIC_PAGE_NAME}
	oc get dc ${STATIC_PAGE_NAME} -o json | grep '"image":' | awk '{ print $2 }' | tr -d ',"' \
		| tee -a ./container_img.log
elif [ "${COMMAND}" == "deploy-from-tools" ]
then
	oc process -f ${OC_DEPLOY} -n ${PROJECT} -p NAME=${STATIC_PAGE_NAME} BUILD_PROJECT=${TOOLS_PROJECT} \
		| oc apply -f -
	oc get route ${STATIC_PAGE_NAME} || \
		oc expose svc ${STATIC_PAGE_NAME}
	oc get dc ${STATIC_PAGE_NAME} -o json | grep '"image":' | awk '{ print $2 }' | tr -d ',"' \
		| tee -a ./container_img.log
else
	echo
	echo "Parameter '${COMMAND}' not understood."
	echo
fi
