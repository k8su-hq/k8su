const k8s = require('@kubernetes/client-node');
const EventType = require('./eventType');

module.exports = class TemporaryRoleBinding {
    constructor(kubeConfig, logger, request) {
        this.kubeConfig = kubeConfig;
        this.request = request;
        this.deleteAfter = undefined;
        this.logger = logger;

        this.needsApproval = false;
        this.approvalListener = false;
        
        this.bindingApi = kubeConfig.makeApiClient(k8s.RbacAuthorizationV1Api);
        this.unregister;
    }

    create(roleWatcher, requestWatcher, approvalWatcher) {
        this.roleWatcher = roleWatcher;
        this.requestWatcher = requestWatcher;
        this.approvalWatcher = approvalWatcher;

        const fetchedRole = roleWatcher.get(this.request.metadata.namespace, this.request.spec.temporaryRole);
        if ( fetchedRole == undefined ) {
            this.logger.error("request refers to non-existing role: " + this.request.spec.temporaryRole);
            return;
        } else {
            this.role = fetchedRole;
        }
        
        const namespace = this.request.metadata.namespace;
        const millisToExpiration = this.role.spec.leaseTimeSeconds*1000;

        // these need to be changed when it needs approval (approval moment counts)
        const now = new Date().getTime();

        if ( this.role.spec.needsApproval && this.role.spec.needsApproval === true ) {
            this.needsApproval = true;

            this.approvalListener = item => {
                if ( item.spec.temporaryRoleRequest === this.request.metadata.name
                    && item.metadata.namespace === namespace ) {

                    if ( item.spec.approvedBy == this.request.spec.createdBy ) {
                        this.logger.info("temporary role can't be approved by the same user");
                    } else {
                        // Got approval!
                        const approvedAt = new Date(item.metadata.creationTimestamp);
                        const removeAt = approvedAt.getTime() + millisToExpiration;

                        if ( removeAt > now ) {
                            this.logger.info("new approval triggered a role binding creation: " + this.request.metadata.selfLink);

                            this.createRole(namespace, removeAt - now);
                        } else {
                            this.logger.info("old approval pending: " + item.metadata.selfLink);
                            this.deleteBinding(true);
                        }
                    }
                }
            };

            this.approvalWatcher.on(EventType.INIT, this.approvalListener);
            this.approvalWatcher.on(EventType.CREATED, this.approvalListener);
            this.approvalWatcher.on(EventType.UPDATED, this.approvalListener);

            this.registerOnEvents();
        } else {
            const createdAt = new Date(this.request.metadata.creationTimestamp);
            const removeAt = createdAt.getTime() + millisToExpiration;

            if ( removeAt > now ) {
                this.logger.info("new request triggered a role binding creation: " + this.request.metadata.selfLink);

                this.createRole(namespace, removeAt - now);
                this.registerOnEvents();
            } else {
                this.logger.info("old request pending: " + this.request.metadata.selfLink);
                this.deleteBinding(true);
            }
        }
    }

    createRole(namespace, millis) {
        const body = this.createRoleFor(namespace);

        this.bindingApi.createNamespacedRoleBinding(namespace, body)
                    .then(res => this.logger.info("created role binding: " + body.metadata.selfLink))
                    .catch(err => {
                        this.logger.error("could not create role binding for " + this.request.metadata.selfLink);
                        this.logger.error(err);
                    });

        this.setupDeletionIn(millis);
    }

    setupDeletionIn(millis) {
        clearTimeout(this.deleteAfter);
        this.deleteAfter = setTimeout(() => {
            this.logger.info("time reached to delete " + this.request.metadata.selfLink);
            this.deleteBinding(true)
        }, millis);
    }
    
    registerOnEvents() {
        const roleHandler = (type, item) => {
            if ( type == EventType.DELETED ) {
                this.logger.info("delete binding because of deletion of temporary role");
                this.deleteBinding(true);
            }
        };

        const requestHandler = (type, item) => {
            if ( type == EventType.DELETED ) {
                this.logger.info("delete binding because of deletion of temporary role request");
                this.deleteBinding(false);
            }
        };

        this.roleWatcher.on(this.role.metadata.selfLink, roleHandler);
        this.requestWatcher.on(this.request.metadata.selfLink, requestHandler);

        this.unregister = () => {
            this.roleWatcher.removeListener(this.role.metadata.selfLink, roleHandler);
            this.requestWatcher.removeListener(this.request.metadata.selfLink, requestHandler);

            if ( this.approvalListener ) {
                this.approvalWatcher.removeListener(EventType.CREATED, this.approvalListener);
                this.approvalWatcher.removeListener(EventType.INIT, this.approvalListener);
                this.approvalWatcher.removeListener(EventType.UPDATED, this.approvalListener);
            }
        };
    }

    deleteBinding(deleteRequest) {
        clearTimeout(this.deleteAfter);

        if ( this.unregister ) {
            this.unregister();
        }

        // request
        if ( deleteRequest ) {
            this.requestWatcher.deleteResource(this.request.metadata.namespace, this.request.metadata.name)
                .then(res => this.logger.info("deleted request: " + this.request.metadata.selfLink))
                .catch(err => {
                    this.logger.error("could not delete request: " + this.request.metadata.selfLink);
                    this.logger.error(err);
                });
        }
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