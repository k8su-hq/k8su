#!/bin/bash

kubectl -n k8su delete TemporaryRole request-without-approve
kubectl apply -f ./role.yml