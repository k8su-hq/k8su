const k8s = require('@kubernetes/client-node');
const EventType = require('./eventType');

module.exports = class TemporaryRoleBinding {
    constructor(kubeConfig, temporaryRole, temporaryRoleRequest) {
        this.kubeConfig = kubeConfig;
        this.role = temporaryRole;
        this.request = temporaryRoleRequest;
        this.deleteAfter = undefined;
        
        this.bindingApi = kubeConfig.makeApiClient(k8s.RbacAuthorizationV1Api);
    }

    logError(err) {
        if ( err.body && err.body.message ) {
            console.log(err.body.message);
        }
    }

    create(roleWatcher, requestWatcher) {
        this.roleWatcher = roleWatcher;
        this.requestWatcher = requestWatcher;

        // TODO: check if already there - if there is update?
        const ns = this.request.metadata.namespace;
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

        this.requestWatcher.on(this.request.metadata.selfLink, (type, item) => {
            if ( type == EventType.DELETED ) {
                console.log("delete binding because of deletion of temporary role request");
                this.deleteBinding();
            }
        });
        /*
            if role is update or request is updated -> update role binding?
        */
    }

    deleteBinding() {
        clearTimeout(this.deleteAfter);

        // binding
        this.bindingApi.deleteNamespacedRoleBinding(this.getBindingName(), this.request.metadata.namespace)
            .then(res => console.log("deleted binding: " + this.getBindingName()))
            .catch(err => this.logError(err));
        
        // request
        this.requestWatcher.deleteResource(this.request.metadata.namespace, this.request.metadata.name)
            .then(res => console.log("deleted request: " + this.request.metadata.selfLink))
            .catch(err => this.logError(err));
    }

    getBindingName() {
        return this.role.metadata.name + '-request';
    }

    createRoleFor(namespace) {
        let body = new k8s.V1Role();
        body.metadata = {
            name: this.getBindingName(),
            namespace: namespace
        };

        body.subjects = [];

        if ( this.role.spec.subject.serviceAccount != undefined ) {
            body.subjects.push({
                kind: 'ServiceAccount',
                name: this.role.spec.subject.serviceAccount,
                namespace: namespace
            });
        } else if ( this.role.spec.subject.user != undefined ) {
            body.subjects.push({
                kind: 'User',
                name: this.role.spec.subject.user,
                apiGroup: 'rbac.authorization.k8s.io'
            });
        } else if ( this.role.spec.subject.group != undefined ) {
            body.subjects.push({
                kind: 'Group',
                name: this.role.spec.subject.group,
                apiGroup: 'rbac.authorization.k8s.io'
            });
        }
        
        body.roleRef = {
            kind: 'Role', name: this.role.spec.role, apiGroup: 'rbac.authorization.k8s.io'
        }

        // owned by the request
        body.metadata.ownerReferences = [
            {
                apiVersion: this.request.apiVersion,
                controller: true,
                blockOwnerDeletion: true,
                kind: this.request.kind,
                name: this.request.metadata.name,
                uid: this.request.metadata.uid
            }
        ];

        return body;
    }
}