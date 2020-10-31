# k8su
Kubernetes operator to make temporary role bindings for operation reasons.
The name is a combination of k8s and su obviously. Pronounced anyway you want.

# Installation
At your own risk you can install this piece of extreme beta software:
1. Install the CustomResourceDefinitions in "/crd".
2. Create the docker images with the "build-push-images.sh" script in "/app/". Add your own registry at the top.
3. Run the "certs-macos.sh" script in /app/deployments/ to get the secrets for the mutating webhook.
4. Use the "install-webhook.sh" to install the mutating webhook.
6. Install the "controller-deploy.yml" file with kubectl (and alter accordingly).
7. Optionally install the "notifier-deploy.yml" if you want Slack integration.