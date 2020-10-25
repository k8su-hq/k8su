#!/bin/bash

while true; do 
    kubectl apply -f ./lease.yml
    sleep 3
    kubectl delete temporaryrolelease lease-a-bit -n k8su
    sleep 3
done