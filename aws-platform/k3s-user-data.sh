#!/bin/bash
set -euxo pipefail
# Install k3s as a single-node server.
# --write-kubeconfig-mode 644 lets us read the cluster's kubeconfig afterwards (to give to Jenkins).
curl -sfL https://get.k3s.io | sh -s - server --write-kubeconfig-mode 644