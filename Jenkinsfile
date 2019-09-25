import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import java.util.regex.Pattern

@NonCPS
/*
 * gets a url from an openshift route
 */
String getUrlForRoute(String routeName, String projectNameSpace = '') {

  def nameSpaceFlag = ''
  if(projectNameSpace?.trim()) {
    nameSpaceFlag = "-n ${projectNameSpace}"
  }

  def url = sh (
    script: "oc get routes ${nameSpaceFlag} -o wide --no-headers | awk \'/${routeName}/{ print match(\$0,/edge/) ?  \"https://\"\$2 : \"http://\"\$2 }\'",
    returnStdout: true
  ).trim()

  return url
}

/*
 * Sends a rocket chat notification
 */
def notifyRocketChat(text, url) {
    def rocketChatURL = url
    def message = text.replaceAll(~/\'/, "")
    def payload = JsonOutput.toJson([
      "username":"Jenkins",
      "icon_url":"https://wiki.jenkins.io/download/attachments/2916393/headshot.png",
      "text": message
    ])

    sh("curl -X POST -H 'Content-Type: application/json' --data \'${payload}\' ${rocketChatURL}")
}

/*
 * takes in a sonarqube status json payload
 * and returns the status string
 */
def sonarGetStatus (jsonPayload) {
  def jsonSlurper = new JsonSlurper()
  return jsonSlurper.parseText(jsonPayload).projectStatus.status
}

/*
 * Updates the global pastBuilds array: it will iterate recursively
 * and add all the builds prior to the current one that had a result
 * different than 'SUCCESS'.
 */
def buildsSinceLastSuccess(previousBuild, build) {
  if ((build != null) && (build.result != 'SUCCESS')) {
    pastBuilds.add(build)
    buildsSinceLastSuccess(pastBuilds, build.getPreviousBuild())
  }
}

/*
 * Generates a string containing all the commit messages from
 * the builds in pastBuilds.
 */
@NonCPS
def getChangeLog(pastBuilds) {
  def log = ""
  for (int x = 0; x < pastBuilds.size(); x++) {
    for (int i = 0; i < pastBuilds[x].changeSets.size(); i++) {
      def entries = pastBuilds[x].changeSets[i].items
      for (int j = 0; j < entries.length; j++) {
        def entry = entries[j]
        log += "* ${entry.msg} by ${entry.author} \n"
      }
    }
  }
  return log;
}

def nodejsTester () {
  openshift.withCluster() {
    openshift.withProject() {
      podTemplate(label: 'node-tester', name: 'node-tester', serviceAccount: 'jenkins', cloud: 'openshift', containers: [
        containerTemplate(
          name: 'jnlp',
          image: 'registry.access.redhat.com/openshift3/jenkins-agent-nodejs-8-rhel7',
          resourceRequestCpu: '500m',
          resourceLimitCpu: '800m',
          resourceRequestMemory: '2Gi',
          resourceLimitMemory: '4Gi',
          workingDir: '/tmp',
          command: '',
        )
      ]) {
        node("node-tester") {
          checkout scm
          try {
            sh 'npm run tests'
          } finally {
            echo "Unit Tests Passed"
          }
        }
      }
      return true
    }
  }
}

// todo templates can be pulled from a repository, instead of declared here
def nodejsLinter () {
  openshift.withCluster() {
    openshift.withProject() {
      podTemplate(label: 'node-linter', name: 'node-linter', serviceAccount: 'jenkins', cloud: 'openshift', containers: [
        containerTemplate(
          name: 'jnlp',
          image: 'registry.access.redhat.com/openshift3/jenkins-agent-nodejs-8-rhel7',
          resourceRequestCpu: '500m',
          resourceLimitCpu: '1000m',
          resourceRequestMemory: '2Gi',
          resourceLimitMemory: '4Gi',
          activeDeadlineSeconds: '1200',
          workingDir: '/tmp',
          command: '',
          args: '${computer.jnlpmac} ${computer.name}',
        )
      ]) {
        node("node-linter") {
          checkout scm
          try {
            // install deps to get angular-cli
            sh 'npm install @angular/compiler @angular/core @angular/cli @angular-devkit/build-angular codelyzer rxjs tslint'
            sh 'npm run lint'
          } finally {
            echo "Linting Passed"
          }
        }
      }
      return true
    }
  }
}

// todo templates can be pulled from a repository, instead of declared here
def nodejsSonarqube () {
  openshift.withCluster() {
    openshift.withProject() {
      podTemplate(label: 'node-sonarqube', name: 'node-sonarqube', serviceAccount: 'jenkins', cloud: 'openshift', containers: [
        containerTemplate(
          name: 'jnlp',
          image: 'registry.access.redhat.com/openshift3/jenkins-agent-nodejs-8-rhel7',
          resourceRequestCpu: '500m',
          resourceLimitCpu: '1000m',
          resourceRequestMemory: '2Gi',
          resourceLimitMemory: '4Gi',
          workingDir: '/tmp',
          command: '',
          args: '${computer.jnlpmac} ${computer.name}',
        )
      ]) {
        node("node-sonarqube") {
          checkout scm
          dir('sonar-runner') {
            try {
              // run scan
              SONARQUBE_URL = getUrlForRoute('sonarqube').trim()
              echo "${SONARQUBE_URL}"

              sh "npm install typescript"
              sh returnStdout: true, script: "./gradlew sonarqube -Dsonar.host.url=${SONARQUBE_URL} -Dsonar. -Dsonar.verbose=true --stacktrace --info"

              // wiat for scan status to update
              sleep(30)

              // check if sonarqube passed
              SONARQUBE_STATUS_URL = "${SONARQUBE_URL}/api/qualitygates/project_status?projectKey=org.sonarqube:eagle-public"

              SONARQUBE_STATUS_JSON = sh(returnStdout: true, script: "curl -w '%{http_code}' '${SONARQUBE_STATUS_URL}'")
              SONARQUBE_STATUS = sonarGetStatus (SONARQUBE_STATUS_JSON)

              if ( "${SONARQUBE_STATUS}" == "ERROR") {
                echo "Scan Failed"

                notifyRocketChat(
                  "@all The latest build ${env.BUILD_DISPLAY_NAME} of eagle-public seems to be broken. \n ${env.BUILD_URL}\n Error: \n Sonarqube scan failed: ${SONARQUBE_URL}",
                  ROCKET_DEPLOY_WEBHOOK
                )

                currentBuild.result = 'FAILURE'
                exit 1
              } else {
                echo "Sonarqube Scan Passed"
              }

            } catch (error) {
              notifyRocketChat(
                "@all The latest build ${env.BUILD_DISPLAY_NAME} of eagle-public seems to be broken. \n ${env.BUILD_URL}\n Error: \n ${error.message}",
                ROCKET_DEPLOY_WEBHOOK
              )
              throw error
            } finally {
              echo "Sonarqube Scan Complete"
            }
          }
        }
      }
      return true
    }
  }
}

def zapScanner () {
  openshift.withCluster() {
    openshift.withProject() {
      // The jenkins-slave-zap image has been purpose built for supporting ZAP scanning.
      podTemplate(
        label: 'owasp-zap',
        name: 'owasp-zap',
        serviceAccount: 'jenkins',
        cloud: 'openshift',
        containers: [
          containerTemplate(
            name: 'jnlp',
            image: '172.50.0.2:5000/openshift/jenkins-slave-zap',
            resourceRequestCpu: '500m',
            resourceLimitCpu: '1000m',
            resourceRequestMemory: '3Gi',
            resourceLimitMemory: '4Gi',
            workingDir: '/home/jenkins',
            command: '',
            args: '${computer.jnlpmac} ${computer.name}'
          )
        ]
      ){
        node('owasp-zap') {
          // The name  of the ZAP report
          def ZAP_REPORT_NAME = "zap-report.xml"

          // The location of the ZAP reports
          def ZAP_REPORT_PATH = "/zap/wrk/${ZAP_REPORT_NAME}"

          // The name of the "stash" containing the ZAP report
          def ZAP_REPORT_STASH = "zap-report"

          // Dynamicaly determine the target URL for the ZAP scan ...
          def TARGET_URL = getUrlForRoute('eagle-public', 'esm-dev').trim()
          echo "Target URL: ${TARGET_URL}"

          dir('zap') {

            // The ZAP scripts are installed on the root of the jenkins-slave-zap image.
            // When running ZAP from there the reports will be created in /zap/wrk/ by default.
            // ZAP has problems with creating the reports directly in the Jenkins
            // working directory, so they have to be copied over after the fact.
            def retVal = sh (
              returnStatus: true,
              script: "/zap/zap-baseline.py -x ${ZAP_REPORT_NAME} -t ${TARGET_URL}"
            )
            echo "Return value is: ${retVal}"

            // Copy the ZAP report into the Jenkins working directory so the Jenkins tools can access it.
            sh (
              returnStdout: true,
              script: "mkdir -p ./wrk/ && cp /zap/wrk/${ZAP_REPORT_NAME} ./wrk/"
            )
          }

          // Stash the ZAP report for publishing in a different stage (which will run on a different pod).
          echo "Stash the report for the publishing stage ..."
          stash name: "${ZAP_REPORT_STASH}", includes: "zap/wrk/*.xml"

        }
      }
    }
  }
}

def postZapToSonar () {
  openshift.withCluster() {
    openshift.withProject() {
      // The jenkins-python3nodejs template has been purpose built for supporting SonarQube scanning.
      podTemplate(
        label: 'jenkins-python3nodejs',
        name: 'jenkins-python3nodejs',
        serviceAccount: 'jenkins',
        cloud: 'openshift',
        containers: [
          containerTemplate(
            name: 'jnlp',
            image: '172.50.0.2:5000/openshift/jenkins-slave-python3nodejs',
            resourceRequestCpu: '1000m',
            resourceLimitCpu: '2000m',
            resourceRequestMemory: '2Gi',
            resourceLimitMemory: '4Gi',
            workingDir: '/tmp',
            command: '',
            args: '${computer.jnlpmac} ${computer.name}'
          )
        ]
      ){
        node('jenkins-python3nodejs') {
          // The name  of the ZAP report
          def ZAP_REPORT_NAME = "zap-report.xml"

          // The location of the ZAP reports
          def ZAP_REPORT_PATH = "/zap/wrk/${ZAP_REPORT_NAME}"

          // The name of the "stash" containing the ZAP report
          def ZAP_REPORT_STASH = "zap-report"

          echo "Checking out the sonar-runner folder ..."
          checkout scm

          echo "Preparing the report for the publishing ..."
          unstash name: "${ZAP_REPORT_STASH}"

          SONARQUBE_URL = getUrlForRoute('sonarqube').trim()
          echo "${SONARQUBE_URL}"

          echo "Publishing the report ..."
          dir('sonar-runner') {
            sh (
              // 'sonar.zaproxy.reportPath' must be set to the absolute path of the xml formatted ZAP report.
              // Exclude the report from being scanned as an xml file.  We only care about the results of the ZAP scan.
              returnStdout: true,
              script: "./gradlew sonarqube --stacktrace --info \
                -Dsonar.verbose=true \
                -Dsonar.host.url=${SONARQUBE_URL} \
                -Dsonar.projectName='eagle-public-zap-scan'\
                -Dsonar.projectKey='org.sonarqube:eagle-public-zap-scan' \
                -Dsonar.projectBaseDir='../' \
                -Dsonar.sources='./src/app' \
                -Dsonar.zaproxy.reportPath=${WORKSPACE}${ZAP_REPORT_PATH} \
                -Dsonar.exclusions=**/*.xml"
            )

            // wiat for scan status to update
              sleep(30)

              // check if zap passed
              SONARQUBE_STATUS_URL = "${SONARQUBE_URL}/api/qualitygates/project_status?projectKey=org.sonarqube:eagle-public-zap-scan"

              ZAP_STATUS_JSON = sh(returnStdout: true, script: "curl -w '%{http_code}' '${SONARQUBE_STATUS_URL}'")
              ZAP_STATUS = sonarGetStatus (ZAP_STATUS_JSON)

              if ( "${ZAP_STATUS}" == "ERROR") {
                echo "ZAP Scan Failed"

                notifyRocketChat(
                  "@all The latest build, ${env.BUILD_DISPLAY_NAME} of eagle-public has deployed to dev, but the Zap scan failed. \n ${env.BUILD_URL}\n Error: \n ${SONARQUBE_URL}",
                  ROCKET_DEPLOY_WEBHOOK
                )
              } else {
                echo "ZAP Scan Passed"
              }
          }
        }
      }
    }
  }
}

def CHANGELOG = "No new changes"
def IMAGE_HASH = "latest"

pipeline {
  agent any
  options {
    disableResume()
  }
  stages {
    stage('Parallel Stage') {
      failFast true
      parallel {
        stage('Build') {
          agent any
          steps {
            script {
              pastBuilds = []
              buildsSinceLastSuccess(pastBuilds, currentBuild);
              CHANGELOG = getChangeLog(pastBuilds);

              echo ">>>>>>Changelog: \n ${CHANGELOG}"

              try {
                sh("oc extract secret/rocket-chat-secrets --to=${env.WORKSPACE} --confirm")
                ROCKET_DEPLOY_WEBHOOK = sh(returnStdout: true, script: 'cat rocket-deploy-webhook')
                ROCKET_QA_WEBHOOK = sh(returnStdout: true, script: 'cat rocket-qa-webhook')

                echo "Building eagle-public develop branch"
                openshiftBuild bldCfg: 'eagle-public-angular', showBuildLogs: 'true'
                openshiftBuild bldCfg: 'eagle-public-build', showBuildLogs: 'true'
                echo "Build done"

                echo ">>> Get Image Hash"
                // Don't tag with BUILD_ID so the pruner can do it's job; it won't delete tagged images.
                // Tag the images for deployment based on the image's hash
                IMAGE_HASH = sh (
                  script: """oc get istag eagle-public:latest -o template --template=\"{{.image.dockerImageReference}}\"|awk -F \":\" \'{print \$3}\'""",
                  returnStdout: true).trim()
                echo ">> IMAGE_HASH: ${IMAGE_HASH}"
              } catch (error) {
                notifyRocketChat(
                  "@all The build ${env.BUILD_DISPLAY_NAME} of eagle-public, seems to be broken.\n ${env.BUILD_URL}\n Error: \n ${error.message}",
                  ROCKET_DEPLOY_WEBHOOK
                )
                throw error
              }
            }
          }
        }

        // stage('Unit Tests') {
        //   agent { node { label 'nodejs' }}
        //   steps {
        //     script {
        //       echo "Placeholder - Running unit-tests"
              // def result = nodejsTester()
        //     }
        //   }
        // }

        stage('Linting') {
          steps {
            script {
              echo "Running linter"
              def result = nodejsLinter()
            }
          }
        }

        stage('Sonarqube') {
          steps {
            script {
              echo "Running Sonarqube"
              def result = nodejsSonarqube()
            }
          }
        }
      }
    }

    stage('Deploy to dev'){
      agent any
      steps {
        script {
          try {
            echo "Deploying to dev..."
            openshiftTag destStream: 'eagle-public', verbose: 'false', destTag: 'dev', srcStream: 'eagle-public', srcTag: "${IMAGE_HASH}"
            sleep 5
            // todo update namespace before switching over
            openshiftVerifyDeployment depCfg: 'eagle-public', namespace: 'esm-dev', replicaCount: 1, verbose: 'false', verifyReplicaCount: 'false', waitTime: 600000
            echo ">>>> Deployment Complete"

            notifyRocketChat(
              "A new version of eagle-public is now in Dev, build: ${env.BUILD_DISPLAY_NAME} \n Changes: \n ${CHANGELOG}",
              ROCKET_DEPLOY_WEBHOOK
            )
            notifyRocketChat(
              "@all A new version of eagle-public is now in Dev and ready for QA. \n Changes to Dev: \n ${CHANGELOG}",
              ROCKET_QA_WEBHOOK
            )
          } catch (error) {
            notifyRocketChat(
              "@all The build ${env.BUILD_DISPLAY_NAME} of eagle-public, seems to be broken.\n ${env.BUILD_URL}\n Error: \n ${error.message}",
              ROCKET_DEPLOY_WEBHOOK
            )
            currentBuild.result = "FAILURE"
            throw new Exception("Deploy failed")
          }
        }
      }
    }

    stage('Zap') {
      steps {
        script {
          echo "Running Zap Scan"
          def result = zapScanner()
        }
      }
    }


    stage('Zap to Sonarqube') {
      steps {
        script {
          echo "Posting Zap Scan to Sonarqube Report"
          def result = postZapToSonar()
        }
      }
    }

    // stage('BDD Tests') {
    //   agent { label: bddPodLabel }
      // steps{
      //   echo "BDD placeholder"
      //   echo "Build: ${BUILD_ID}"
        // checkout scm
        // todo determine how to call improved BDD Stack
      // }
    // }
  }
}
