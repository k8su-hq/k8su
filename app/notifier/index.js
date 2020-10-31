const winston = require('winston');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const app = express();
const { WebClient } = require('@slack/web-api');
const fetch = require('node-fetch');

const k8s = require('@kubernetes/client-node');
const TemporaryRoleWatcher = require('./lib/temporaryRoleWatcher');
const TemporaryRoleRequestWatcher = require('./lib/temporaryRoleRequestWatcher');
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

const logEvent = (evt, item) => logger.info("event " + evt + " for " + item.metadata.name);

const watchers = [requestWatcher, approvalWatcher];

// add logging
watchers.forEach(watcher => {
    watcher.onCreate(item => logEvent('create', item));
    watcher.onUpdate(item => logEvent('update', item));

    watcher.start();
});

// setup notification
const token = process.env.SLACK_TOKEN;
const channel = process.env.SLACK_CHANNEL;
const slackApi = new WebClient(token);

const handle = item => {
    
    roleWatcher.fetch(item.metadata.namespace, item.spec.temporaryRole).then(res => {
        const role = res.body;

        if ( role.spec.needsApproval && role.spec.needsApproval === true ) {
            slackApi.chat.postMessage({
                channel: channel,

                blocks: [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": ':question: Approval asked for *' + role.metadata.name + "* by *" + item.spec.createdBy + "*"
                        }
                    },
                    {
                        "type": "actions",
                        block_id: item.metadata.selfLink,
                        "elements": [
                            {
                                "type": "button",
                                "action_id": "approve_request:no",
                                "style": "danger",
                                "value": "no",
                                "text": {
                                    "type": "plain_text",
                                    "text": ":no_entry: Deny",
                                    "emoji": true
                                }
                            },
                            {
                                "type": "button",
                                "style": "primary",
                                "value": "yes",
                                "action_id": "approve_request:yes",
                                "text": {
                                    "type": "plain_text",
                                    "text": ":white_check_mark: Approve",
                                    "emoji": true
                                },
                                "confirm": {
                                    "title": {
                                        "type": "plain_text",
                                        "text": "Are you sure?"
                                    },
                                    "text": {
                                        "type": "mrkdwn",
                                        "text": "Do you really want to assign this temporary role?"
                                    },
                                    "confirm": {
                                        "type": "plain_text",
                                        "text": "Do it"
                                    },
                                    "deny": {
                                        "type": "plain_text",
                                        "text": "Stop, I've changed my mind!"
                                    }
                                }
                            }
                        ]
                    }
                ]
            }).then(res => {
                // this.logger.debug(res)
            }).catch(err => this.logger.error(err));
        } else {
            slackApi.chat.postMessage({
                channel: channel,
                attachments: [
                    {
                        text: ':white_check_mark: Role *' + role.metadata.name + "* requested by *" + item.spec.createdBy + "* for " + role.spec.leaseTimeSeconds + "s and immediately assigned",
                        callback_id: item.metadata.selfLink,
                        color: "#26A001"
                    }
                ]
            }).then(res => this.logger.error(res))
            .catch(err => {
                this.logger.error(err)
            });
        }
    });
};

requestWatcher.onCreate(handle);
requestWatcher.onUpdate(handle);

// setup express
app.use(bodyParser.json());

app.get('/live', (req, res) => res.send("OK")); // live and readiness probe

// mutating webhook itself
var urlencodedParser = bodyParser.urlencoded({ extended: false });
app.post('/webhook', urlencodedParser, (req, res) => {
    const json = JSON.parse(req.body.payload);

    // console.log(JSON.stringify(json, null, 2));

    const source = "slack:" + json.user.id + ":" + json.user.username;

    if ( json.actions ) {
        json.actions.forEach(action => {
            const parsed = action.block_id.split("/");
            // /apis/roles.k8su.io/v1alpha1/namespaces/k8su/temporaryrolerequests/lease-a-bit-longer
            if ( action.action_id === 'approve_request:yes' ) {
                approvalWatcher.createApprovalFor(parsed[5], parsed[7], source)
                    .then(res => {
                        logger.info("created approval for " + action.block_id + " by: " + source);

                        const body = {
                            text: ":white_check_mark: Approved by <@"+json.user.id+">: " + json.message.blocks[0].text.text
                        };

                        fetch(json.response_url, {
                            method: 'POST',
                            body:    JSON.stringify(body),
                            headers: { 'Content-Type': 'application/json' },
                        })
                        .then(res => res.json())
                        .then(json => console.log(json));
                    }).catch(err => {
                        logger.error("could not create approval for " + action.block_id + " by: " + source);
                        logger.error(err);
                    })
            } else {
                const body = {
                    text: ":no_entry: Denied by <@"+json.user.id+">: " + json.message.blocks[0].text.text
                };

                fetch(json.response_url, {
                    method: 'POST',
                    body:    JSON.stringify(body),
                    headers: { 'Content-Type': 'application/json' },
                })
                .then(res => res.json())
                .then(json => console.log(json));
            }
        });
    }
    res.status(200).send("ok");
})

// starting
const port = 80;
logger.info("starting server at port " + port);
http.createServer(app).listen(port);