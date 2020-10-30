const ResourceWatcher = require("./resourceWatcher");

module.exports = class TemporaryRoleApprovalWatcher extends ResourceWatcher {
    constructor(kubeConfig, logger) {
        super(kubeConfig, logger, 'roles.k8su.io', 'v1alpha1', 'temporaryroleapprovals');
    }

    createApprovalFor(namespace, name, approvedSource) {
        const body = this.createApprovalResourceFor(namespace, name, approvedSource);
        return this.customApi.createNamespacedCustomObject(this.group, this.version, namespace, this.plural, body);
    }

    createApprovalResourceFor(namespace, name, approvedSource) {
        const body = {
            apiVersion: this.group+"/" + this.version,
            kind: 'TemporaryRoleApproval',
        };

        body.metadata = {
            name: "approval-for-" + name + "-" + new Date().getTime(),
            namespace: namespace
        };

        body.spec = {
            temporaryRoleRequest: name,
            approvedSource: approvedSource
        };
        return body;
    }
}