#!/bin/bash

while true; do 
    kubectl apply -f ./temp-role.yml
    sleep 3
    kubectl delete temporaryrole.roles.k8su.io/temp-role-assignment -n k8su
    sleep 3
done