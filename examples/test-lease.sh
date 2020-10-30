#!/bin/bash

while true; do 
    kubectl apply -f ./lease.yml
    sleep 10
    kubectl delete temporaryrolerequest lease-a-bit-longer -n k8su
    sleep 10
done