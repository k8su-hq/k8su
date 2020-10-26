const k8s = require('@kubernetes/client-node');
const TemporaryRoleRequestWatcher = require('./lib/temporaryRoleRequestWatcher');
const TemporaryRoleWatcher = require('./lib/temporaryRoleWatcher');
const TemporaryRoleBinding = require('./lib/temporaryRoleBinding');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const roleWatcher = new TemporaryRoleWatcher(kc);
const requestWatcher = new TemporaryRoleRequestWatcher(kc);

const logEvent = (evt, item) => {
    console.log("Event: " + evt + " for " + item.metadata.name);
};

// add logging
roleWatcher.onInit(item => logEvent('init', item));
roleWatcher.onDelete(item => logEvent('delete', item));
roleWatcher.onUpdate(item => logEvent('update', item));
roleWatcher.onCreate(item => logEvent('create', item));

// add logging
requestWatcher.onInit(item => logEvent('init', item));
requestWatcher.onDelete(item => logEvent('delete', item));
requestWatcher.onUpdate(item => logEvent('update', item));
requestWatcher.onCreate(item => logEvent('create', item));

roleWatcher.start();
requestWatcher.start();

const addRoleBinding = item => {
    try {
        console.log("creating role binding");
        const temporaryRole = roleWatcher.get(item.metadata.namespace, item.spec.temporaryRole);
        
        // add role binding
        // rbac.authorization.k8s.io/v1 => roles
        
        const binding = new TemporaryRoleBinding(kc, temporaryRole, item);
        binding.create(roleWatcher, requestWatcher);
    } catch(err) {
        console.log(err);
    }
};

requestWatcher.onCreate(item => addRoleBinding(item));
requestWatcher.onUpdate(item => addRoleBinding(item));
requestWatcher.onInit(item => addRoleBinding(item));