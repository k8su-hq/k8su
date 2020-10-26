# k8su
Kubernetes operator to make temporary role bindings for operation reasons.

# Installation
At your own risk you can install this piece of extreme beta software:
1. Install the CustomResourceDefinitions in "/crd".
2. Create a docker image with the Dockerfile in "/app/controller".
3. Use the deployment file in "/app" for deploying towards your cluster.