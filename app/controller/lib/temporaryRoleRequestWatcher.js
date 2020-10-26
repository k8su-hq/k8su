const ResourceWatcher = require("./resourceWatcher");

module.exports = class TemporaryRoleRequestWatcher extends ResourceWatcher {
    constructor(kubeConfig) {
        super(kubeConfig, 'roles.k8su.io', 'v1alpha1', 'temporaryrolerequests');
    }
}