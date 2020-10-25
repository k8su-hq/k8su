const k8s = require('@kubernetes/client-node');
const TemporaryRoleLeaseWatcher = require('./lib/temporaryRoleLeaseWatcher');
const TemporaryRoleWatcher = require('./lib/temporaryRoleWatcher');
const TemporaryRoleBinding = require('./lib/temporaryRoleBinding');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const trw = new TemporaryRoleWatcher(kc);
const trwl = new TemporaryRoleLeaseWatcher(kc);

const logEvent = (evt, item) => {
    console.log("Event: " + evt + " for " + item.metadata.name);
};

// add logging
trw.onInit(item => logEvent('init', item));
trw.onDelete(item => logEvent('delete', item));
trw.onUpdate(item => logEvent('update', item));
trw.onCreate(item => logEvent('create', item));

// add logging
trwl.onInit(item => logEvent('init', item));
trwl.onDelete(item => logEvent('delete', item));
trwl.onUpdate(item => logEvent('update', item));
trwl.onCreate(item => logEvent('create', item));

trw.start();
trwl.start();

// add role binding stuff
const addRoleBinding = item => {
    const temporaryRole = trw.get(item.metadata.namespace, item.spec.temporaryRole);
    
    // add role binding
    // rbac.authorization.k8s.io/v1 => roles
    try {
        const binding = new TemporaryRoleBinding(kc, temporaryRole, item);
        binding.create(trw, trwl);
    } catch(err) {
        // console.log(err);
    }
};

trwl.onCreate(item => addRoleBinding(item));
trwl.onUpdate(item => addRoleBinding(item));
trwl.onInit(item => addRoleBinding(item));