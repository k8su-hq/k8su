const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

const namespace = process.env.NAMESPACE ? process.env.NAMESPACE : 'k8su';
const delay = process.env.DELAY ? process.env.DELAY : 2000;

setInterval(() => {
    k8sApi.listNamespacedPod(namespace).then((res) => {
        console.log(new Date().toISOString());
        console.log(res.body);
    }).catch(err => {
        console.log("could not fetch pods");
    });
}, delay);