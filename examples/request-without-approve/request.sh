#!/bin/bash

kubectl -n k8su delete TemporaryRoleRequest request-without-approve-request
kubectl apply -f ./request.yml