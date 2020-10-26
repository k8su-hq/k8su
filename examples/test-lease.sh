#!/bin/bash

while true; do 
    kubectl apply -f ./lease.yml
    sleep 3
    kubectl delete temporaryrolerequest lease-a-bit-longer -n k8su
    sleep 3
done