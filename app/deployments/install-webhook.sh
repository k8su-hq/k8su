#!/bin/bash

APP=k8su-mutatingwebhook
K8S_NAMESPACE=k8su
CERTS_DIR=./certs

kubectl create secret tls ${APP}-tls-secret --cert=${CERTS_DIR}/${APP}.${K8S_NAMESPACE}.pem --key=${CERTS_DIR}/${APP}.${K8S_NAMESPACE}.key -n ${K8S_NAMESPACE}

kubectl apply -f ./mutatingwebhook-deploy.yml -n ${K8S_NAMESPACE}
kubectl apply -f ./mutatingwebhook-config.yml -n ${K8S_NAMESPACE}