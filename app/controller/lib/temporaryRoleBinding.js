const k8s = require('@kubernetes/client-node');
const EventType = require('./eventType');

module.exports = class TemporaryRoleBinding {
    constructor(kubeConfig, temporaryRole, temporaryRoleLease) {
        this.kubeConfig = kubeConfig;
        this.role = temporaryRole;
        this.lease = temporaryRoleLease;
        this.deleteAfter = undefined;
        
        this.bindingApi = kubeConfig.makeApiClient(k8s.RbacAuthorizationV1Api);
    }

    logError(err) {
        if ( err.body && err.body.message ) {
            console.log(err.body.message);
        }
    }

    create(temporaryRoleWatcher, temporaryRoleLeaseWatcher) {
        this.roleWatcher = temporaryRoleWatcher;
        this.leaseWatcher = temporaryRoleLeaseWatcher;

        // TODO: check if already there - if there is update?
        const ns = this.lease.metadata.namespace;
        const body = this.createRoleFor(ns);
        this.bindingApi.createNamespacedRoleBinding(ns, body)
            .then(res => console.log("created role binding: " + body.metadata.name))
            .catch(err => this.logError(err));

        clearTimeout(this.deleteAfter);
        this.deleteAfter = setTimeout(() => this.deleteBinding(), this.role.spec.leaseTimeSeconds*1000);

        this.registerOnEvents();
    }
    
    registerOnEvents() {
        this.roleWatcher.on(this.role.metadata.selfLink, (type, item) => {
            if ( type == EventType.DELETED ) {
                console.log("delete binding because of deletion of temporary role");
                this.deleteBinding();
            }
        });

        this.leaseWatcher.on(this.lease.metadata.selfLink, (type, item) => {
            if ( type == EventType.DELETED ) {
                console.log("delete binding because of deletion of temporary role lease");
                this.deleteBinding();
            }
        });
        /*
            if role is update or lease is updated -> update role binding?
        */
    }

    deleteBinding() {
        clearTimeout(this.deleteAfter);

        // binding
        this.bindingApi.deleteNamespacedRoleBinding(this.getBindingName(), this.lease.metadata.namespace)
            .then(res => console.log("deleted binding: " + this.getBindingName()))
            .catch(err => this.logError(err));
        
        // lease
        this.leaseWatcher.deleteResource(this.lease.metadata.namespace, this.lease.metadata.name)
            .then(res => console.log("deleted lease: " + this.lease.metadata.selfLink))
            .catch(err => this.logError(err));
    }

    getBindingName() {
        return this.role.metadata.name + '-lease';
    }

    createRoleFor(namespace) {
        let body = new k8s.V1Role();
        body.metadata = {
            name: this.getBindingName(),
            namespace: namespace
        };

        body.subjects = [{
            kind: 'ServiceAccount',
            name: this.role.spec.assignToServiceAccount,
            namespace: namespace
        }];
        
        body.roleRef = {
            kind: 'Role', name: this.role.spec.role, apiGroup: 'rbac.authorization.k8s.io'
        }
        return body;
    }
}