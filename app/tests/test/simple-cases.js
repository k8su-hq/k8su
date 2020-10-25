const k8s = require('@kubernetes/client-node');
var expect = require('chai').expect

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const rbacApi = kc.makeApiClient(k8s.RbacAuthorizationV1Api);
const customApi = kc.makeApiClient(k8s.CustomObjectsApi);
const namespace = 'k8su-test';

function _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function wrap(promise) {
    return new Promise((res, rej) => {
        promise.then(() => {
            res();
        }).catch((err) => {
            console.log(err);
            res(undefined);
        })
    });
}

describe('K8su', function () {

    before(async function() {
        // ns
        await wrap(k8sApi.createNamespace({
            metadata: {
                name: namespace,
            },
        }));

        // svc account
        const ps = [];
        const body = new k8s.V1ServiceAccount();
        body.metadata = {
            name: 'k8su-svc-account',
            namespace: namespace
        };
        ps.push(wrap(k8sApi.createNamespacedServiceAccount(namespace, body)));

        // role
        let roleBody = new k8s.V1Role();
        roleBody.metadata = {
            name: 'k8su-role',
            namespace: namespace
        };
        roleBody.rules = [{
            apiGroups: [""],
            resources: ["pods"],
            verbs: ["get", "watch", "list"]
        }];
        ps.push(wrap(rbacApi.createNamespacedRole(namespace, roleBody)));

        await Promise.all(ps);
    });

    after(async function() {
        await wrap(k8sApi.deleteNamespace(namespace));
    });
    
    
    describe('temporaryRole', function () {

        const group = "roles.k8su.io";
        const version = "v1alpha1";
        const pluralLeases = "temporaryroleleases";
        const pluralRoles = "temporaryroles";
        
        const createTemporaryRole = (name, spec) => {
            return customApi.createNamespacedCustomObject(group, version, namespace, pluralRoles, {
                apiVersion: 'roles.k8su.io/v1alpha1',
                kind: 'TemporaryRole',
                metadata: {
                    name: name,
                    namespace: namespace
                },
                spec: spec
            });
        };

        const createTemporaryRoleLease = (name, spec) => {
            return customApi.createNamespacedCustomObject(group, version, namespace, pluralLeases, {
                apiVersion: 'roles.k8su.io/v1alpha1',
                kind: 'TemporaryRoleLease',
                metadata: {
                    name: name,
                    namespace: namespace
                },
                spec: spec
            });
        };

        it('should create a temporary role', async function() {
            await createTemporaryRole('simple-role-assignment', {
                role: 'k8su-role',
                leaseTimeSeconds: 2,
                assignToServiceAccount: 'k8su-svc-account'
            });

            await createTemporaryRoleLease('simple-role-assignment-lease', {
                temporaryRole: 'simple-role-assignment'
            });

            await _sleep(1000);

            let rb = await rbacApi.readNamespacedRoleBinding('simple-role-assignment-lease', namespace);
            expect(rb.body.kind).to.be.equal("RoleBinding");

            await _sleep(2000);
            try {
                await rbacApi.readNamespacedRoleBinding('simple-role-assignment-lease', namespace);
                expect(false).to.be.true;
            } catch(err) {
                // do nothing
                expect(true).to.be.true;
            }
        }).timeout(10000);

        it('should delete the binding after deletion of lease', async function() {
            await createTemporaryRole('r2', {
                role: 'k8su-role',
                leaseTimeSeconds: 10,
                assignToServiceAccount: 'k8su-svc-account'
            });

            await createTemporaryRoleLease('l2', { temporaryRole: 'r2' });

            await _sleep(1000);

            let rb = await rbacApi.readNamespacedRoleBinding('r2-lease', namespace);
            expect(rb.body.kind).to.be.equal("RoleBinding");

            // delete the lease
            await customApi.deleteNamespacedCustomObject(group, version, namespace, pluralLeases, 'l2');

            // should be gone
            await _sleep(2000);
            try {
                await rbacApi.readNamespacedRoleBinding('r2-lease', namespace);
                expect(false).to.be.true;
            } catch(err) {
                // do nothing
                expect(true).to.be.true;
            }
        }).timeout(10000);

    });
});