pipeline {
  agent {
    kubernetes {
      defaultContainer 'node'          // bare `sh` steps run in the node container
      yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  # --- the language toolchain: npm install / lint / test / audit ---
  - name: node
    image: node:22                     # full image (has git) — NOT node:22-slim
    command: ['cat']
    tty: true
    resources:
      requests: { cpu: "500m", memory: "1Gi" }
  # --- security scanners, each in its own official image ---
  - name: gitleaks
    image: zricethezav/gitleaks:latest
    command: ['cat']
    tty: true
  - name: hadolint
    image: hadolint/hadolint:latest-alpine   # -alpine has a shell; plain tag is distroless (no shell)
    command: ['cat']
    tty: true
  - name: semgrep
    image: semgrep/semgrep:latest
    command: ['cat']
    tty: true
  # --- daemonless image builder ---
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug   # :debug gives a busybox shell
    command: ['/busybox/cat']
    tty: true
    resources:
      requests: { cpu: "500m", memory: "1Gi" }
  # --- image scanner + registry pusher ---
  - name: trivy
    image: aquasec/trivy:latest
    command: ['cat']
    tty: true
  - name: skopeo
    image: quay.io/skopeo/stable:latest
    command: ['cat']
    tty: true
'''
    }
  }

  environment {
    IMAGE = 'ghcr.io/pvsafwa/learning-tracker'
  }

  options { timestamps() }

  stages {
    stage('Checkout') {
      steps {
        checkout scm                                       // checks the repo out into the shared workspace
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        }
        echo "Building commit ${env.GIT_SHA}"
      }
    }

    stage('Install') {
      steps { container('node') { sh 'npm ci' } }
    }

    stage('Quality') {
      parallel {
        stage('Lint')       { steps { container('node') { sh 'npm run lint' } } }
        stage('Format')     { steps { container('node') { sh 'npm run format:check' } } }
        stage('Typecheck')  { steps { container('node') { sh 'npm run typecheck' } } }
        stage('Unit tests') { steps { container('node') { sh 'npm test' } } }
      }
    }

    stage('Security') {
      parallel {
        stage('Dependency check') {
          steps { container('node') { sh 'npm audit --omit=dev --audit-level=high' } }
        }
        stage('Secret scan') {
          steps { container('gitleaks') { sh 'gitleaks git . --redact' } }
        }
        stage('Dockerfile lint') {
          steps { container('hadolint') { sh 'hadolint --failure-threshold warning Dockerfile' } }
        }
        stage('Code scan (SAST)') {
          steps { container('semgrep') { sh 'semgrep scan --config auto --error --metrics off .' } }
        }
      }
    }

    stage('Build image (no push)') {
      steps {
        container('kaniko') {
          sh '''
            /kaniko/executor \
              --context "$PWD" \
              --dockerfile Dockerfile \
              --destination "$IMAGE:$GIT_SHA" \
              --no-push \
              --tar-path image.tar
          '''
        }
      }
    }

    stage('Image scan (Trivy)') {
      steps {
        container('trivy') {
          sh 'trivy image --input image.tar --ignore-unfixed --severity HIGH,CRITICAL --exit-code 1'
        }
      }
    }

    stage('Push to GHCR') {
      steps {
        container('skopeo') {
          withCredentials([usernamePassword(credentialsId: 'ghcr-credentials',
                                            usernameVariable: 'REG_USER',
                                            passwordVariable: 'REG_PASS')]) {
            sh '''
              skopeo copy --dest-creds "$REG_USER:$REG_PASS" \
                docker-archive:image.tar \
                docker://$IMAGE:$GIT_SHA
            '''
          }
        }
      }
    }
  }
}