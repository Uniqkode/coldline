param location string
param networkId string
param storageId string
param vaultId string

var targets = [
  { name: 'blob', id: storageId, zone: 'privatelink.blob.${environment().suffixes.storage}', group: 'blob' }
  { name: 'vault', id: vaultId, zone: 'privatelink.vaultcore.azure.net', group: 'vault' }
]
resource zones 'Microsoft.Network/privateDnsZones@2020-06-01' = [for target in targets: {
  name: target.zone
  location: 'global'
}]
resource links 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [for (target, i) in targets: {
  parent: zones[i]
  name: 'coldline-network'
  location: 'global'
  properties: { virtualNetwork: { id: networkId }, registrationEnabled: false }
}]
resource endpoints 'Microsoft.Network/privateEndpoints@2023-11-01' = [for target in targets: {
  name: 'coldline-${target.name}'
  location: location
  properties: { subnet: { id: '${networkId}/subnets/endpoints' }, privateLinkServiceConnections: [{ name: target.name, properties: { privateLinkServiceId: target.id, groupIds: [target.group] } }] }
}]
resource groups 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-11-01' = [for (target, i) in targets: {
  parent: endpoints[i]
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: target.name, properties: { privateDnsZoneId: zones[i].id } }] }
}]
