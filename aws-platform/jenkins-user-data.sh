#!/bin/bash
set -euxo pipefail   # stop on any error; log every command (helps debugging later)

# Install Java 21 FIRST (Jenkins needs it; installing it before Jenkins avoids startup failures)
apt-get update
apt-get install -y fontconfig openjdk-21-jre

# Add the official Jenkins apt repository
mkdir -p /etc/apt/keyrings
wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2026.key
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  > /etc/apt/sources.list.d/jenkins.list

# Install Jenkins and make sure it runs now and on every boot
apt-get update
apt-get install -y jenkins
systemctl enable jenkins
systemctl start jenkins