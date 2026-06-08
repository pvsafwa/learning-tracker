pipeline {
    agent any
    stages {
        stage('Checkout sanity') {
            steps {
                echo 'Jenkins is connected to the repo 🎉'
                sh 'ls -la'
                sh 'git log -1 --oneline'
                
            }
        }
    }
}