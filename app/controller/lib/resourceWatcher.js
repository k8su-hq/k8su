const EventEmitter = require('events');
const k8s = require('@kubernetes/client-node');
const EventType = require('./eventType');

module.exports = class ResourceWatcher extends EventEmitter {
    constructor(kubeConfig, group, version, plural) {
        super();

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

    logError(err) {
        if ( err.body && err.body.message ) {
            console.log(err.body.message);
        }
    }

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
                    // console.log(res.body);
                }).catch(err => {
                    delete this.resources[obj.metadata.selfLink];
                    this.emit(EventType.DELETED, obj);
                    this.emit(obj.metadata.selfLink, EventType.DELETED, obj);
                });
            } catch(err) {
                this.logError(err);
            }
        }, (err) => {
            this.logError(err);
        });

        // initial sync
        this.sync();
    }

    sync() {
        this.coreApi.listNamespace().then(res => {
            res.body.items.forEach(ns => {
                this.customApi.listNamespacedCustomObject(
                    this.group,
                    this.version,
                    ns.metadata.name,
                    this.plural
                ).then(res => {
                    res.body.items.forEach(item => {
                        this.resources[item.metadata.selfLink] = item;
                        this.emit(EventType.INIT, item);
                    });
                }).catch(err => {
                    this.logError(err);
                });
            });
        });
    }
    
}