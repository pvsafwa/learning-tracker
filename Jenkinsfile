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
        stage('Security') {
            parallel {
                stage('Dependency check') {
                    steps {
                        sh 'npm audit --omit=dev --audit-level=high'
                    }
                }
                stage('Secret scan') {
                    steps {
                        sh 'docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest git /repo'
                    }
                }
                stage('Dockerfile lint') {
                    steps {
                        sh 'docker run --rm -i hadolint/hadolint hadolint --failure-threshold warning - < Dockerfile'
                    }
                }
                stage('Code scan') {
                    steps {
                        sh 'docker run --rm -v "$PWD:/src" semgrep/semgrep semgrep scan --config auto --error /src'
                    }
                }
            }
        }
        stage('Build image') {
            steps {
                sh '''
                    GIT_SHA=$(git rev-parse --short HEAD)
                    docker build -t learning-tracker:${GIT_SHA} .
                '''
            }
        }
        stage('Image scan') {
            steps {
                sh '''
                    GIT_SHA=$(git rev-parse --short HEAD)
                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image --ignore-unfixed --severity HIGH,CRITICAL --exit-code 1 learning-tracker:${GIT_SHA}
                '''
            }
        }
        stage('Push image') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'ghcr-credentials', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_TOKEN')]) {
                    sh '''
                        GIT_SHA=$(git rev-parse --short HEAD)
                        echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
                        docker tag learning-tracker:${GIT_SHA} ghcr.io/pvsafwa/learning-tracker:${GIT_SHA}
                        docker push ghcr.io/pvsafwa/learning-tracker:${GIT_SHA}
                        docker logout ghcr.io
                    '''
                }
            }
        }
    }
}