#!/bin/bash

kubectl -n k8su delete TemporaryRole operations-role
kubectl -n k8su delete TemporaryRoleRequest need-some-operation-time
kubectl -n k8su delete TemporaryRoleApproval approve-need-some-operation-time
kubectl -n k8su apply -f ./approval-request.yml
sleep 2
kubectl -n k8su apply -f ./approval-approve.yml