#!/bin/bash

export REGISTRY="192.168.1.10:5000"

cd controller
docker build -t ${REGISTRY}/k8su/k8su-controller:latest .

cd ../notifier
docker build -t ${REGISTRY}/k8su/k8su-notifier:latest .

cd ../mutatingwebhook
docker build -t ${REGISTRY}/k8su/k8su-mutatingwebhook:latest .

docker push ${REGISTRY}/k8su/k8su-mutatingwebhook:latest
docker push ${REGISTRY}/k8su/k8su-controller:latest
docker push ${REGISTRY}/k8su/k8su-notifier:latest