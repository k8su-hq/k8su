## The following needs to be tested

- Subjects: Group/User/ServiceAccount
- Cancel request by user/group/serviceaccount

kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: admin
  namespace: ns
  selfLink: /apis/rbac.authorization.k8s.io/v1/namespaces/oost-build/rolebindings/admin
  creationTimestamp: '2020-07-15T14:17:17Z'
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: group-name
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-role-name

kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: cluster-admin-2
  selfLink: /apis/rbac.authorization.k8s.io/v1/clusterrolebindings/cluster-admin-2
  creationTimestamp: '2020-04-06T14:12:21Z'
subjects:
  - kind: User
    apiGroup: rbac.authorization.k8s.io
    name: gijs.van.dulmen
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
