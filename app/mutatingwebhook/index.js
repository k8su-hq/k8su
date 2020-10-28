const winston = require('winston');
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const app = express();

const keyLocation = process.env.CERT_KEY ? process.env.CERT_KEY : './tls.key';
const certLocation = process.env.CERT ? process.env.CERT : './tls.crt';

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

// setup express
app.use(bodyParser.json());

app.get('/live', (req, res) => res.send("OK")); // live and readiness probe

// mutating webhook itself
app.post('/mutate', (req, res, next) => {
    let admReq = req.body.request;

    logger.info(admReq.uid + ' - ' + admReq.resource.resource + ' - ' + admReq.name + ' - ' + admReq.namespace + ' - ' + admReq.operation)

    // don't support anything other then create
    if ( admReq.operation != 'CREATE' ) {
        const response = {
            kind: req.body.kind,
            apiVersion: req.body.apiVersion,
            request: req.body.request,
            response: {
                uid: req.body.request.uid,
                allowed: false
            }
        };
    
        res.type('application/json')
        res.status(200).send(response)
        return;
    }


    let changedBy = 'unknown';
    if ( admReq.userInfo && admReq.userInfo.username ) {
        changedBy = 'user/' + admReq.userInfo.username;
    }
    
    // https://github.com/kubernetes/api/blob/7edad22604e1b0437963e77bdf884a331461ed26/admission/v1beta1/types.go#L116
    let patch = [];

    if ( admReq.kind.kind == 'TemporaryRoleRequest' ) {
        patch.push({
            op: "add",
            path: "/spec/createdBy",
            value: changedBy
        });
    } else if ( admReq.kind.kind == 'TemporaryRoleApproval' ) {
        patch.push({
            op: "add",
            path: "/spec/approvedBy",
            value: changedBy
        });
    }

    const stringifiedPatch = JSON.stringify(patch);

    const response = {
        kind: req.body.kind,
        apiVersion: req.body.apiVersion,
        request: req.body.request,
        response: {
            uid: req.body.request.uid,
            allowed: true,
            patch: Buffer.from(stringifiedPatch).toString('base64'),
            patchType: "JSONPatch"
        }
    };

    res.type('application/json')
    res.status(200).send(response)
})

const certs = {
    key: fs.readFileSync(keyLocation),
    cert: fs.readFileSync(certLocation)
};

// starting
const port = 443;
logger.info("starting server at port " + port + " with certs at " + keyLocation + " / " + certLocation);
https.createServer(certs, app).listen(port);