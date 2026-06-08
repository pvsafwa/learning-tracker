pipeline {
    agent { docker { image 'node:22'}}
    stages {
        stage('Tooling') {
            steps {
                echo 'Jenkins is connected to the repo 🎉'
                sh 'node --version'
                sh 'npm --version'
                sh 'git log -1 --oneline'

            }
        }
    }
}