

const winston = require('winston');

const k8s = require('@kubernetes/client-node');
const TemporaryRoleRequestWatcher = require('./lib/temporaryRoleRequestWatcher');
const TemporaryRoleWatcher = require('./lib/temporaryRoleWatcher');
const TemporaryRoleBinding = require('./lib/temporaryRoleBinding');

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

const logEvent = (evt, item) => logger.debug("event " + evt + " for " + item.metadata.name);

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

roleWatcher.start().then(() => {
    logger.info("init - fetched roles");
    requestWatcher.start().then(() => {
        logger.info("init - fetched requests");
    }).catch(err => {
        logger.error("init - could not fetch requests");
        logger.error(err);
    })
}).catch(err => {
    logger.error("init - could not fetch role");
    logger.error(err);
});

let requests = {};

const addRoleBinding = item => {
    try {
        logger.info("created role binding for request " + item.metadata.selfLink);
        const binding = new TemporaryRoleBinding(kc, logger, item);
        binding.create(roleWatcher, requestWatcher);
    } catch(err) {
        logger.error("could not create role binding for request " + item.metadata.selfLink);
        logger.error(err);
    }
};

requestWatcher.onCreate(item => addRoleBinding(item));
requestWatcher.onUpdate(item => addRoleBinding(item));
requestWatcher.onInit(item => addRoleBinding(item));