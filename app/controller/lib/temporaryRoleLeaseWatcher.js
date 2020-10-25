const ResourceWatcher = require("./resourceWatcher");

module.exports = class TemporaryRoleLeaseWatcher extends ResourceWatcher {
    constructor(kubeConfig) {
        super(kubeConfig, 'roles.k8su.io', 'v1alpha1', 'temporaryroleleases');
    }
}