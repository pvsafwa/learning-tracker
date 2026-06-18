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
        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }
        stage('Typecheck') {
            steps {
                sh 'npm run typecheck'
            }
        }
        stage('Unit Tests') {
            steps {
                sh 'npm test'
            }
        }
        stage('Build Image') {
            steps {
                sh '''
                    GIT_SHA=$(git rev-parse --short HEAD)
                    docker build -t learning-tracker:${GIT_SHA} .
                    '''
            }
        }

    }
}