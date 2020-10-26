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
        const pluralRequests = "temporaryrolerequests";
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

        const createTemporaryRoleRequest = (name, spec) => {
            return customApi.createNamespacedCustomObject(group, version, namespace, pluralRequests, {
                apiVersion: 'roles.k8su.io/v1alpha1',
                kind: 'TemporaryRoleRequest',
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
                subject: {
                    serviceAccount: 'k8su-svc-account'
                }
            });

            await createTemporaryRoleRequest('simple-role-assignment-request', {
                temporaryRole: 'simple-role-assignment'
            });

            await _sleep(1000);

            // should be created
            let rb = await rbacApi.readNamespacedRoleBinding('simple-role-assignment-request', namespace);
            expect(rb.body.kind).to.be.equal("RoleBinding");

            // should be gone again
            await _sleep(2000);
            try {
                await rbacApi.readNamespacedRoleBinding('simple-role-assignment-request', namespace);
                expect(false).to.be.true;
            } catch(err) {
                // do nothing
                expect(err.body).to.be.not.undefined;
            }

            // so has to be the request
            try {
                await customApi.getNamespacedCustomObject(group, version, namespace, pluralRequests, 'simple-role-assignment-request');
                expect(false).to.be.true;
            } catch(err) {
                // do nothing
                expect(err.body).to.be.not.undefined;
            }
        }).timeout(10000);

        it('should delete the binding after deletion of request', async function() {
            await createTemporaryRole('r2', {
                role: 'k8su-role',
                leaseTimeSeconds: 999,
                subject: {
                    serviceAccount: 'k8su-svc-account'
                }
            });

            await createTemporaryRoleRequest('l2', { temporaryRole: 'r2' });

            await _sleep(1000);

            let rb = await rbacApi.readNamespacedRoleBinding('r2-request', namespace);
            expect(rb.body.kind).to.be.equal("RoleBinding");

            // delete the request
            await customApi.deleteNamespacedCustomObject(group, version, namespace, pluralRequests, 'l2');

            // should be gone
            await _sleep(2000);
            try {
                await rbacApi.readNamespacedRoleBinding('r2-request', namespace);
                expect(false).to.be.true;
            } catch(err) {
                // do nothing
                expect(err.body).to.be.not.undefined;
            }
        }).timeout(10000);

        it('should delete the binding after deletion of temporary role', async function() {
            await createTemporaryRole('r3', {
                role: 'k8su-role',
                leaseTimeSeconds: 999,
                subject: {
                    serviceAccount: 'k8su-svc-account'
                }
            });

            await createTemporaryRoleRequest('l3', { temporaryRole: 'r3' });

            await _sleep(1000);

            let rb = await rbacApi.readNamespacedRoleBinding('r3-request', namespace);
            expect(rb.body.kind).to.be.equal("RoleBinding");

            // delete the request
            await customApi.deleteNamespacedCustomObject(group, version, namespace, pluralRoles, 'r3');

            // should be gone
            await _sleep(2000);
            try {
                await rbacApi.readNamespacedRoleBinding('r3-request', namespace);
                expect(false).to.be.true;
            } catch(err) {
                // do nothing
                expect(err.body).to.be.not.undefined;
            }
        }).timeout(10000);

        it('should create a temporary role binding with correct fields', async function() {
            await createTemporaryRole('svc-role', {
                role: 'k8su-role',
                leaseTimeSeconds: 2,
                subject: {
                    serviceAccount: 'k8su-svc-account'
                }
            });
    
            const request = await createTemporaryRoleRequest('svc-sra-request', {
                temporaryRole: 'svc-role'
            });
            const requestBody = request.body;
    
            await _sleep(1000);
    
            // should be created
            let rb = await rbacApi.readNamespacedRoleBinding('svc-role-request', namespace);
            let body = rb.body;
            
            expect(body.kind).to.be.equal("RoleBinding");
            expect(body.apiVersion).to.be.equal("rbac.authorization.k8s.io/v1");

            expect(body.roleRef.apiGroup).to.be.equal('rbac.authorization.k8s.io');
            expect(body.roleRef.kind).to.be.equal('Role');
            expect(body.roleRef.name).to.be.equal('k8su-role');

            expect(body.subjects[0].kind).to.be.equal('ServiceAccount');
            expect(body.subjects[0].name).to.be.equal('k8su-svc-account');
            expect(body.subjects[0].namespace).to.be.equal(namespace);

            const owner = body.metadata.ownerReferences[0];
            expect(owner.apiVersion).to.be.equal('roles.k8su.io/v1alpha1');
            expect(owner.kind).to.be.equal('TemporaryRoleRequest');
            expect(owner.name).to.be.equal('svc-sra-request');
            expect(owner.uid).to.be.equal(requestBody.metadata.uid);
            expect(owner.controller).to.be.equal(true);
            expect(owner.blockOwnerDeletion).to.be.equal(true);
        }).timeout(10000);

        it('should create a temporary role binding for users', async function() {
            await createTemporaryRole('user-role', {
                role: 'k8su-role',
                leaseTimeSeconds: 2,
                subject: {
                    user: 'gijs'
                }
            });
    
            const request = await createTemporaryRoleRequest('user-sra-request', { temporaryRole: 'user-role' });
            
            await _sleep(1000);
    
            // should be created
            let rb = await rbacApi.readNamespacedRoleBinding('user-role-request', namespace);
            let body = rb.body;

            expect(body.subjects[0].kind).to.be.equal('User');
            expect(body.subjects[0].name).to.be.equal('gijs');
            expect(body.subjects[0].apiGroup).to.be.equal('rbac.authorization.k8s.io');
        }).timeout(10000);

        it('should create a temporary role binding for groups', async function() {
            await createTemporaryRole('group-role', {
                role: 'k8su-role',
                leaseTimeSeconds: 2,
                subject: {
                    group: 'grp1'
                }
            });
    
            const request = await createTemporaryRoleRequest('group-sra-request', { temporaryRole: 'group-role' });
            
            await _sleep(1000);
    
            // should be created
            let rb = await rbacApi.readNamespacedRoleBinding('group-role-request', namespace);
            let body = rb.body;

            expect(body.subjects[0].kind).to.be.equal('Group');
            expect(body.subjects[0].name).to.be.equal('grp1');
            expect(body.subjects[0].apiGroup).to.be.equal('rbac.authorization.k8s.io');
        }).timeout(10000);
    });
});