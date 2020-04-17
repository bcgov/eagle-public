#!/bin/sh -l
#
source "$(dirname ${0})/common/common"

#%
#% OpenShift Build Helper
#%
#%   Intended for use with a pull request-based pipeline.
#%   Suffixes incl.: pr-###, test and prod.
#%
#% Usage:
#%
#%   ${THIS_FILE} [SUFFIX] [apply]
#%
#% Examples:
#%
#%   Provide a PR number. Defaults to a dry-run.
#%   ${THIS_FILE} pr-0
#%
#%   Apply when satisfied.
#%   ${THIS_FILE} pr-0 apply
#%
PR_DEPLOY_EXISTS=$(oc -n ${PROJ_TOOLS} get dc/${NAME_OBJ} -o 'jsonpath={.status.availableReplicas}')

if ["${PR_DEPLOY_EXISTS}" != 1 ]; then
  # git checkout eagle-helper-pods
  git checkout https://github.com/bcgov/eagle-helper-pods.git
  cd eagle-helper-pods/setup-teardown/

  ##set target deployment params
  find . -name 'projectset.config' -exec sed -e 's/^\( *TARGET_PROJECT_SET=*\)[^ ]*\(.*\)*$/\1PR\2/' {} \;

  #set unique name (ie. pr-branchName) for pr builds & deployments
  cd CUSTOM_SETTINGS/PR
  find . -name '*.params' -exec sed -i "" -e 's/pr-placeholder/${SUFFIX}/g' {} \;
  find . -name '*.config' -exec sed -i "" -e 's/pr-placeholder/${SUFFIX}/g' {} \;

  #create builds and deploys
  cd ../..
  ./setup_all.sh
else
  # git repo set to my fork for testing, should point at pr src repo
  OC_PROCESS="oc -n ${PROJ_TOOLS} process -f ${PATH_BC} -p NAME=${BUILD_NAME} -p GIT_BRANCH=${GIT_BRANCH} -P GIT_REPO=${GIT_REPO}"
  OC_APPLY="oc -n ${PROJ_TOOLS} apply -f -"
  [ "${APPLY}" ] || OC_APPLY="${OC_APPLY} --dry-run"
fi

#else - builds and deploys already built by associated pr in other repo (ie. api)

  #trigger build and update dc image tag for this app (ie. public)

if [ "${APPLY}" ]; then
	# Get the most recent build version
	BUILD_LAST=$(oc -n ${PROJ_TOOLS} get bc/${BUILD_NAME} -o 'jsonpath={.status.lastVersion}')
	# Command to get the build result
	BUILD_RESULT=$(oc -n ${PROJ_TOOLS} get build/${BUILD_NAME}-${BUILD_LAST} -o 'jsonpath={.status.phase}')

	# Make sure that result is a successful completion
	if [ "${BUILD_RESULT}" != "Complete" ]; then
		echo "Build result: ${BUILD_RESULT}"
		echo -e "\n*** Build not complete! ***\n"
		exit 1
  else
    #update dc to watch for tag SUFFIX
    # git repo set to my fork for testing, should point at pr src repo
    OC_PROCESS="oc -n ${PROJ_TOOLS} process -f ${PATH_DC} -p NAME=${DEPLOY_NAME} -p GROUP_NAME=${GROUP_NAME} -p IMAGE_NAMESPACE=${PROJ_TOOLS} -p TAG_NAME=${SUFFIX} -p APPLICATION_DOMAIN=${APPLICATION_DOMAIN} -p REMOTE_API_PATH=${REMOTE_API_PATH} -p REMOTE_ADMIN_PATH=${REMOTE_ADMIN_PATH}"
	fi
fi

# Provide oc command instruction
#
display_helper "${OC_PROCESS} | ${OC_APPLY}" "${OC_START_BUILD}"
