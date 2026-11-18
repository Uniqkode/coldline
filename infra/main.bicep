targetScope = 'resourceGroup'

@minLength(3)
@maxLength(16)
param namePrefix string = 'coldline'
param location string = resourceGroup().location
param siteLocation string = 'westeurope'
param entraTenantId string
param entraClientId string
@secure()
param entraClientSecret string
@secure()
param membershipsJson string = ''
@secure()
@minLength(24)
param enquiryHashSalt string
param ownerUserIds string = ''
@description('An existing Azure OpenAI account in this resource group; leave empty until approved and provisioned.')
param openAIAccountName string = ''
param openAIDeployment string = ''
param visionEndpoint string = ''
param inferenceHost string = ''
@description('Premium compute is required for outbound VNet integration. No resources are deployed automatically by a Git push.')
param privateNetworking bool = false

var suffix = uniqueString(resourceGroup().id, namePrefix)
var storageName = 'cl${suffix}'
var vaultName = 'cl-${suffix}'
var functionName = '${namePrefix}-api-${suffix}'
var blobRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var vaultRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs-${suffix}'
  location: location
  properties: { retentionInDays: 30, sku: { name: 'PerGB2018' } }
}
resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${namePrefix}-insights-${suffix}'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logs.id, DisableLocalAuth: true }
}
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    defaultToOAuthAuthentication: true
    publicNetworkAccess: privateNetworking ? 'Disabled' : 'Enabled'
    encryption: { keySource: 'Microsoft.Storage', services: { blob: { enabled: true }, file: { enabled: true } } }
  }
}
resource blobs 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: { isVersioningEnabled: true, deleteRetentionPolicy: { enabled: true, days: 7 } }
}
resource control 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: 'coldline-control'
  properties: { publicAccess: 'None' }
}
resource audit 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobs
  name: 'coldline-audit'
  properties: { publicAccess: 'None' }
}
resource retention 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = {
  parent: audit
  name: 'default'
  properties: { immutabilityPeriodSinceCreationInDays: 365, allowProtectedAppendWrites: true }
}
resource lifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: { policy: { rules: [{ name: 'expire-rate-buckets', enabled: true, type: 'Lifecycle', definition: { filters: { blobTypes: ['blockBlob'], prefixMatch: ['coldline-control/limits/'] }, actions: { baseBlob: { delete: { daysAfterModificationGreaterThan: 2 } } } } }] } }
}
// Function host state is separate from tenant data so private data networking does not break the host.
resource hostStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'clh${suffix}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { minimumTlsVersion: 'TLS1_2', supportsHttpsTrafficOnly: true, allowBlobPublicAccess: false }
}
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: privateNetworking ? 'Disabled' : 'Enabled'
  }
}
resource secrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [for item in [
  { name: 'memberships', value: membershipsJson }
  { name: 'enquiry-salt', value: enquiryHashSalt }
]: {
  parent: vault
  name: item.name
  properties: { value: item.value }
}]
resource hostSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'host-storage'
  properties: { value: 'DefaultEndpointsProtocol=https;AccountName=${hostStorage.name};AccountKey=${hostStorage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}' }
}
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${namePrefix}-compute-${suffix}'
  location: location
  kind: 'elastic'
  sku: { name: 'EP1', tier: 'ElasticPremium', capacity: 1 }
  properties: { reserved: true, maximumElasticWorkerCount: 5 }
}
resource network 'Microsoft.Network/virtualNetworks@2023-11-01' = if (privateNetworking) {
  name: '${namePrefix}-network'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.28.0.0/16'] }
    subnets: [
      { name: 'functions', properties: { addressPrefix: '10.28.1.0/24', delegations: [{ name: 'web', properties: { serviceName: 'Microsoft.Web/serverFarms' } }] } }
      { name: 'endpoints', properties: { addressPrefix: '10.28.2.0/24', privateEndpointNetworkPolicies: 'Disabled' } }
    ]
  }
}
resource api 'Microsoft.Web/sites@2024-04-01' = {
  name: functionName
  location: location
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    virtualNetworkSubnetId: privateNetworking ? '${network.id}/subnets/functions' : null
    siteConfig: { linuxFxVersion: 'NODE|22', minTlsVersion: '1.2', ftpsState: 'Disabled', http20Enabled: true, vnetRouteAllEnabled: privateNetworking }
  }
}
resource blobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, api.id, blobRole)
  properties: { roleDefinitionId: blobRole, principalId: api.identity.principalId, principalType: 'ServicePrincipal' }
}
resource vaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, api.id, vaultRole)
  properties: { roleDefinitionId: vaultRole, principalId: api.identity.principalId, principalType: 'ServicePrincipal' }
}
resource openAI 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = { name: openAIAccountName }
resource inferenceAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(openAIAccountName)) {
  scope: openAI
  name: guid(openAI.id, api.id, 'openai-user')
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'), principalId: api.identity.principalId, principalType: 'ServicePrincipal' }
}
resource site 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${namePrefix}-web-${suffix}'
  location: siteLocation
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Standard', tier: 'Standard' }
  properties: { allowConfigFileUpdates: true }
}
resource siteVaultAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: authVault
  name: guid(authVault.id, site.id, vaultRole)
  properties: { roleDefinitionId: vaultRole, principalId: site.identity.principalId, principalType: 'ServicePrincipal' }
}
// SWA retrieves only its authentication secret from a separate RBAC-protected vault.
// Its managed identity cannot join the private data network.
resource authVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'cla-${suffix}'
  location: location
  properties: { tenantId: subscription().tenantId, sku: { family: 'A', name: 'standard' }, enableRbacAuthorization: true, enableSoftDelete: true, enablePurgeProtection: true, softDeleteRetentionInDays: 90, publicNetworkAccess: 'Enabled' }
}
resource authSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: authVault
  name: 'entra-client-secret'
  properties: { value: entraClientSecret }
}
resource siteSettings 'Microsoft.Web/staticSites/config@2023-12-01' = {
  parent: site
  name: 'appsettings'
  properties: { ENTRA_CLIENT_ID: entraClientId, ENTRA_CLIENT_SECRET: '@Microsoft.KeyVault(SecretUri=${authVault.properties.vaultUri}secrets/entra-client-secret)' }
  dependsOn: [authSecret, siteVaultAccess]
}
resource settings 'Microsoft.Web/sites/config@2024-04-01' = {
  parent: api
  name: 'appsettings'
  properties: {
    FUNCTIONS_EXTENSION_VERSION: '~4'
    FUNCTIONS_WORKER_RUNTIME: 'node'
    WEBSITE_NODE_DEFAULT_VERSION: '~22'
    WEBSITE_RUN_FROM_PACKAGE: '1'
    AzureWebJobsStorage: '@Microsoft.KeyVault(SecretUri=${vault.properties.vaultUri}secrets/host-storage)'
    APPLICATIONINSIGHTS_CONNECTION_STRING: insights.properties.ConnectionString
    APPLICATIONINSIGHTS_AUTHENTICATION_STRING: 'Authorization=AAD'
    COLDLINE_STORAGE_ACCOUNT_URL: storage.properties.primaryEndpoints.blob
    COLDLINE_PUBLIC_ORIGIN: 'https://${site.properties.defaultHostname}'
    COLDLINE_MEMBERSHIPS_JSON: '@Microsoft.KeyVault(SecretUri=${vault.properties.vaultUri}secrets/memberships)'
    COLDLINE_ENQUIRY_HASH_SALT: '@Microsoft.KeyVault(SecretUri=${vault.properties.vaultUri}secrets/enquiry-salt)'
    COLDLINE_OWNER_USER_IDS: ownerUserIds
    AZURE_OPENAI_ENDPOINT: empty(openAIAccountName) ? '' : openAI.properties.endpoint
    AZURE_OPENAI_DEPLOYMENT: openAIDeployment
    COLDLINE_VISION_ENDPOINT: visionEndpoint
    COLDLINE_INFERENCE_HOST: inferenceHost
    // Deploying code is blocked until SWA's linked EasyAuth provider is verified.
    'AzureWebJobs.workspace.Disabled': 'true'
  }
  dependsOn: [secrets, hostSecret, vaultAccess]
}
resource monitoringAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: insights
  name: guid(insights.id, api.id, 'metrics')
  properties: { roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb'), principalId: api.identity.principalId, principalType: 'ServicePrincipal' }
}
module privateData './private-data.bicep' = if (privateNetworking) {
  name: 'private-data'
  params: { location: location, networkId: network.id, storageId: storage.id, vaultId: vault.id }
}
resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  scope: api
  name: 'coldline-operations'
  properties: { workspaceId: logs.id, logs: [{ category: 'FunctionAppLogs', enabled: true }], metrics: [{ category: 'AllMetrics', enabled: true }] }
}
output staticSiteName string = site.name
output functionAppName string = api.name
output functionAppId string = api.id
output origin string = 'https://${site.properties.defaultHostname}'
output storageAccountName string = storage.name
output vaultName string = vault.name
output auditRetentionStatus string = '365-day policy created; review and explicitly lock it before claiming immutable production audit retention.'
output authenticationTenant string = entraTenantId
