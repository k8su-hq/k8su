#!/bin/bash

kubectl -n k8su delete TemporaryRole request-with-approve-role
kubectl -n k8su delete TemporaryRoleRequest request-with-approve-role-request
kubectl apply -f ./role.yml
kubectl apply -f ./request.yml