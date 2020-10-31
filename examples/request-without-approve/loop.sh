#!/bin/bash

while true; do 
    sh setup.sh
    sleep 4
    sh request.sh
    sleep 10
done