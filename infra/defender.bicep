// Subscription-wide paid security plans. This template is never run by the site workflow.
targetScope = 'subscription'
resource storageProtection 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'StorageAccounts'
  properties: { pricingTier: 'Standard', subPlan: 'DefenderForStorageV2' }
}
resource containerProtection 'Microsoft.Security/pricings@2024-01-01' = {
  name: 'Containers'
  properties: { pricingTier: 'Standard' }
}
