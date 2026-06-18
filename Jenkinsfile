pipeline {
    agent any
    tools {
        nodejs 'node22'
    }
    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }
        stage('Quality') {
            parallel {
                stage('Lint') {
                    steps { sh 'npm run lint' }
                }
                stage('Format') {
                    steps { sh 'npm run format:check' }
                }
                stage('Typecheck') {
                    steps { sh 'npm run typecheck' }
                }
                stage('Unit tests') {
                    steps { sh 'npm test' }
                }
            }
        }
    }
}