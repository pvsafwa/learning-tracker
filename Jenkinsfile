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
                        sh 'docker run --rm -i hadolint/hadolint hadolint --no-fail - < Dockerfile'
                    }
                }
                stage('Code scan') {
                    steps {
                        sh 'docker run --rm -v "$PWD:/src" semgrep/semgrep semgrep scan --config auto /src'
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
                    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image learning-tracker:${GIT_SHA}
                '''
            }
        }
    }
}