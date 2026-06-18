pipeline {
    agent any
    stages {
        stage('Build image') {
            steps {
                sh '''
                    GIT_SHA=$(git rev-parse --short HEAD)
                    docker build -t learning-tracker:${GIT_SHA} .
                '''
            }
        }
    }
}