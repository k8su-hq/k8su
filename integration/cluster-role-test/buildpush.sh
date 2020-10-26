#!/bin/bash
docker build -t 192.168.1.10:5000/k8su/test-pods:latest .
docker push 192.168.1.10:5000/k8su/test-pods:latest