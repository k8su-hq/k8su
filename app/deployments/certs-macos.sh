#! /bin/bash
#
# Credits go to: https://github.com/nsubrahm/k8s-mutating-webhook/blob/master/scripts/certs-macos.sh
set -o errexit

WEBHOOK_APP=k8su-mutatingwebhook
K8S_NAMESPACE=k8su
CERTS_DIR=./certs

echo "Creating key - ${WEBHOOK_APP}.${K8S_NAMESPACE}.key"
openssl genrsa -out ${CERTS_DIR}/${WEBHOOK_APP}.${K8S_NAMESPACE}.key 2048

CSR_NAME="${WEBHOOK_APP}.${K8S_NAMESPACE}.csr"
echo "Creating CSR - ${CSR_NAME}"
openssl req -new -key ${CERTS_DIR}/${WEBHOOK_APP}.${K8S_NAMESPACE}.key -subj "/CN=${CSR_NAME}" -out ${CERTS_DIR}/${CSR_NAME} -config ./csr.conf

echo "Checking for CSR object - ${CSR_NAME}"
if (( `kubectl get csr ${CSR_NAME} -n ${K8S_NAMESPACE} 1>/dev/null 2>/dev/null` )); then
  echo "CSR ${CSR_NAME} found. Deleting it."
  kubectl delete csr ${CSR_NAME} -n ${K8S_NAMESPACE} || exit 8  
else
  echo "CSR ${CSR_NAME} not found."
fi

echo "Creating CSR object - ${CSR_NAME}"
cp ./csr-template.yml ./csr.yml
export CSR_BASE64_STRING=`cat ${CERTS_DIR}/${CSR_NAME} | base64 | tr -d '\n'`
sed -i '' "s/CSR_BASE64/${CSR_BASE64_STRING}/g" ./csr.yml
kubectl create -f ./csr.yml -n ${K8S_NAMESPACE}
sleep 5

echo "Approving CSR - ${CSR_NAME}"
kubectl certificate approve ${CSR_NAME} -n ${K8S_NAMESPACE}
sleep 5

echo "Extracting PEM"
kubectl get csr ${CSR_NAME} -o jsonpath='{.status.certificate}' -n ${K8S_NAMESPACE} | openssl base64 -d -A -out ${CERTS_DIR}/${WEBHOOK_APP}.${K8S_NAMESPACE}.pem 
sleep 5

echo "Building the webhook configuration"
export CA_BUNDLE=`kubectl config view --raw --minify --flatten -o jsonpath='{.clusters[].cluster.certificate-authority-data}'`
sed "s/CA_BUNDLE/${CA_BUNDLE}/g" ./mutatingwebhook-config-template.yml > ./mutatingwebhook-config.yml
