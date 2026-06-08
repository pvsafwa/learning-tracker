pipeline {
  agent { docker { image 'node:22' } }

  options {
    timestamps()                        // timestamp each log line (needs Timestamper plugin)
    timeout(time: 15, unit: 'MINUTES')  // kill a hung build instead of running forever
    disableConcurrentBuilds()           // two builds of this branch would fight over the workspace
  }

  stages {
    stage('Install') {
      steps {
        sh 'npm ci'                      // clean, lockfile-exact, reproducible
      }
    }
    stage('Verify') {
      parallel {
        stage('Lint')      { steps { sh 'npm run lint' } }
        stage('Typecheck') { steps { sh 'npm run typecheck' } } // Verified again and no issue found
        stage('Test')      { steps { sh 'npm test' } }
      }
    }
  }

  post {
    success { echo '✅ CI passed — safe to build & deploy' }
    failure { echo '❌ CI failed — open the red stage above' }
    always  { sh 'node --version' }      // cheap breadcrumb of what ran it
  }
}