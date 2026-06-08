pipeline {
    agent { docker { image 'node:22'}}
    options {
        timestamps()
        timeout(time: 15, unit: 'MINUTES')
        disableConcurrentBuilds()
    }
    stages {
        stage('install') {
            steps {
                sh 'npm ci'
            }
        }
        stage('verify') {
            parallel {
                stage('Lint') { steps { sh 'npm run lint' }}
                stage('typecheck') { steps ( sh 'npm run typecheck')}
                stage('Test') { steps { sh 'npm test'}}
            }
        }
    }
    post {
        success { echo '✅ CI passed — safe to build & deploy'}
        failure { echo '❌ CI failed — open the red stage above' }
        always { sh 'node --version' }
    }
}