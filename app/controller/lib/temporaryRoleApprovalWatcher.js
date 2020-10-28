const ResourceWatcher = require("./resourceWatcher");

module.exports = class TemporaryRoleApprovalWatcher extends ResourceWatcher {
    constructor(kubeConfig, logger) {
        super(kubeConfig, logger, 'roles.k8su.io', 'v1alpha1', 'temporaryroleapprovals');
    }
}