// Optional capacity template. Deploy only after evaluating a real model, quota, and workload cost.
targetScope = 'resourceGroup'
param name string = 'coldline-inference'
param location string = resourceGroup().location
param entraAdminGroupObjectIds array
@description('A GPU SKU approved in the selected region and subscription.')
param gpuVmSize string
@minValue(1)
param maximumGpuNodes int = 3

resource cluster 'Microsoft.ContainerService/managedClusters@2024-10-01' = {
  name: name
  location: location
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Base', tier: 'Standard' }
  properties: {
    dnsPrefix: name
    enableRBAC: true
    disableLocalAccounts: true
    aadProfile: { managed: true, enableAzureRBAC: true, tenantID: subscription().tenantId, adminGroupObjectIDs: entraAdminGroupObjectIds }
    oidcIssuerProfile: { enabled: true }
    securityProfile: { workloadIdentity: { enabled: true } }
    networkProfile: { networkPlugin: 'azure', networkPluginMode: 'overlay', networkPolicy: 'azure', loadBalancerSku: 'standard' }
    agentPoolProfiles: [
      { name: 'system', mode: 'System', count: 2, vmSize: 'Standard_D2s_v5', osType: 'Linux', type: 'VirtualMachineScaleSets', enableAutoScaling: true, minCount: 2, maxCount: 3 }
      { name: 'visiongpu', mode: 'User', count: 0, vmSize: gpuVmSize, osType: 'Linux', type: 'VirtualMachineScaleSets', enableAutoScaling: true, minCount: 0, maxCount: maximumGpuNodes, nodeLabels: { workload: 'produce-vision' }, nodeTaints: ['nvidia.com/gpu=true:NoSchedule'] }
    ]
  }
}
output clusterName string = cluster.name
output nextStep string = 'Install a compatible GPU device plugin, deploy a validated model image with workload identity and TLS, then configure COLDLINE_VISION_ENDPOINT. No trained model or endpoint is created by this template.'
