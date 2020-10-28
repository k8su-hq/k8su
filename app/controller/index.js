

const winston = require('winston');

const k8s = require('@kubernetes/client-node');
const TemporaryRoleRequestWatcher = require('./lib/temporaryRoleRequestWatcher');
const TemporaryRoleWatcher = require('./lib/temporaryRoleWatcher');
const TemporaryRoleBinding = require('./lib/temporaryRoleBinding');
const TemporaryRoleApprovalWatcher = require('./lib/temporaryRoleApprovalWatcher');

// setup logger
const logger = winston.createLogger({
    level: 'info',
    transports: []
});

logger.add(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.simple(),
    )
}));

// setup kubernetes
const kc = new k8s.KubeConfig();

if ( process.env.KUBERNETES_SERVICE_HOST ) {
    kc.loadFromCluster();
} else {
    kc.loadFromDefault();
}

const roleWatcher = new TemporaryRoleWatcher(kc, logger);
const requestWatcher = new TemporaryRoleRequestWatcher(kc, logger);
const approvalWatcher = new TemporaryRoleApprovalWatcher(kc, logger);

const logEvent = (evt, item) => logger.debug("event " + evt + " for " + item.metadata.name);

const watchers = [roleWatcher, requestWatcher, approvalWatcher];

// add logging
watchers.forEach(watcher => {
    watcher.onInit(item => logEvent('init', item));
    watcher.onDelete(item => logEvent('delete', item));
    watcher.onUpdate(item => logEvent('update', item));
    watcher.onCreate(item => logEvent('create', item));
});

roleWatcher.start().then(() => {
    logger.info("init - fetched roles");
    requestWatcher.start().then(() => {
        logger.info("init - fetched requests");
        approvalWatcher.start().then(() => {
            logger.info("init - fetched approvals");
        }).catch(err => {
            logger.error("init - could not fetch approvals");
            logger.error(err);
        });
    }).catch(err => {
        logger.error("init - could not fetch requests");
        logger.error(err);
    });
}).catch(err => {
    logger.error("init - could not fetch role");
    logger.error(err);
});

const addRoleBinding = item => {
    try {
        logger.info("created role binding for request " + item.metadata.selfLink);
        const binding = new TemporaryRoleBinding(kc, logger, item);
        binding.create(roleWatcher, requestWatcher, approvalWatcher);
    } catch(err) {
        logger.error("could not create role binding for request " + item.metadata.selfLink);
        logger.error(err);
    }
};

requestWatcher.onCreate(item => addRoleBinding(item));
requestWatcher.onUpdate(item => addRoleBinding(item));
requestWatcher.onInit(item => addRoleBinding(item));