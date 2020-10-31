#!/bin/bash

kubectl -n k8su delete TemporaryRoleApproval request-with-approve-role-request-approval
kubectl apply -f ./approval.yml