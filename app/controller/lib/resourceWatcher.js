const EventEmitter = require('events');
const k8s = require('@kubernetes/client-node');
const EventType = require('./eventType');

module.exports = class ResourceWatcher extends EventEmitter {
    constructor(kubeConfig, logger, group, version, plural) {
        super();

        this.logger = logger;
        this.kubeConfig = kubeConfig;
        this.resources = {};
        this.group = group;
        this.version = version;
        this.plural = plural;

        this.customApi = this.kubeConfig.makeApiClient(k8s.CustomObjectsApi);
        this.coreApi = this.kubeConfig.makeApiClient(k8s.CoreV1Api);
    }

    deleteResource(namespace, name) {
        return this.customApi.deleteNamespacedCustomObject(this.group, this.version, namespace, this.plural, name)
    }

    updateStatus(namespace, name, body) {
        const patch = [
            {
                op: "replace",
                path: "/status",
                value: body
            }
        ];

        const options = { "headers": { "Content-type": k8s.PatchUtils.PATCH_FORMAT_JSON_PATCH } };
        return this.customApi.patchNamespacedCustomObjectStatus(this.group, this.version, namespace, this.plural, name, patch, undefined, undefined, undefined, options);
    }

    get(namespace, name) {
        let part = "/apis/" + this.group;
        part += "/" + this.version;
        part += "/namespaces/" + namespace;
        part += "/" + this.plural
        part += "/" + name;

        if ( this.resources[part] ) {
            return this.resources[part];
        }
        return null;
    }

    onDelete(cb) { this.on(EventType.DELETED, cb); }
    onInit(cb) { this.on(EventType.INIT, cb); }
    onCreate(cb) { this.on(EventType.CREATED, cb); }
    onUpdate(cb) { this.on(EventType.UPDATED, cb); }

    start() {
        const watch = new k8s.Watch(this.kubeConfig);
        watch.watch("/apis/"+this.group+"/"+this.version+"/"+this.plural, {}, (phase, obj) =>{
            try {
                this.customApi.getNamespacedCustomObject(
                    this.group,
                    this.version,
                    obj.metadata.namespace,
                    this.plural,
                    obj.metadata.name
                ).then(res => {
                    this.resources[obj.metadata.selfLink] = res.body;

                    if ( this.resources[obj.metadata.selfLink] != undefined ) {
                        this.emit(EventType.UPDATED, res.body);
                        this.emit(obj.metadata.selfLink, EventType.UPDATED, res.body);
                    } else {
                        this.emit(EventType.CREATED, res.body);
                        this.emit(obj.metadata.selfLink, EventType.CREATED, res.body);
                    }
                }).catch(err => {
                    delete this.resources[obj.metadata.selfLink];
                    this.emit(EventType.DELETED, obj);
                    this.emit(obj.metadata.selfLink, EventType.DELETED, obj);
                });
            } catch(err) {
                this.logger.error("error getting namespaces custom object")
                this.logger.error(err);
            }
        }, (err) => {
            this.logger.error("error watching")
            this.logger.error(err);
        });

        return this.sync();
    }

    async sync() {
        const namespaces = await this.coreApi.listNamespace();

        for (let i = 0; i < namespaces.body.items.length; i++) {
            const namespace = namespaces.body.items[i];

            try {
                const customObjects = await this.customApi.listNamespacedCustomObject(
                    this.group,
                    this.version,
                    namespace.metadata.name,
                    this.plural
                );

                for (let j = 0; j < customObjects.length; j++) {
                    const customObject = customObjects[j];
                    this.resources[customObject.metadata.selfLink] = customObject;
                    this.emit(EventType.INIT, customObject);
                }
            } catch(err) {
                this.logError(err);
            }
        }
    }
    
}