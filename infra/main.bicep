@minLength(1)
@maxLength(64)
@description('Name which is used to generate a short unique hash for each resource')
param name string

@minLength(1)
@description('Primary location for all resources')
param location string

@minLength(1)
@description('Event Hubs name')
param eventHubName string = 'o365events'

@description('App registration client ID')
@secure()
param entraAppClientId string

@description('App registration client secret')
@secure()
param entraAppClientSecret string

@description('Id of the user or app to assign application roles')
param principalId string = ''

@description('Whether the deployment is running on GitHub Actions')
param runningOnGh string = ''

@description('Whether the deployment is running on Azure DevOps Pipeline')
param runningOnAdo string = ''

var principalType = empty(runningOnGh) && empty(runningOnAdo) ? 'User' : 'ServicePrincipal'

var resourceToken = toLower(uniqueString(subscription().id, name, location))
var tags = { 'azd-env-name': name }

var prefix = '${name}-${resourceToken}'

// https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#storage-blob-data-owner
var storageBlobDataOwnerRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')

// https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#azure-event-hubs-data-sender
var eventHubDataSenderRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2b629674-e913-4c01-ae53-ef4638d8f975')

// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/monitor#monitoring-metrics-publisher
var metricsPublisherRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb')

// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/security#key-vault-certificate-user
var keyvaultCertificateUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'db79e9a7-68ee-4b58-9aeb-b90e7c24fcba')

// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/security#key-vault-certificate-officer
var keyvaultCertificateOfficerRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a4417e6f-fecd-4de8-b567-7b0420556985')

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${toLower(take(replace(prefix, '-', ''), 17))}sto'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    defaultToOAuthAuthentication: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
  tags: tags
}

module indexerFunctionApp './functionapp.bicep' = {
  name: 'indexer-func'
  params: {
    name: '${prefix}-indexer-func'
    hostingPlanName: '${prefix}-plan'
    location: location
    runtimeName: 'node'
    runtimeVersion: '20'
    azdServiceName: 'indexer'
    storageAccountName: storageAccount.name
    appInsightsName: applicationInsights.outputs.name
    tags: tags
    environmentVariables: [
      {
        name: 'ENTRA_APP_CLIENT_ID'
        value: entraAppClientId
      }
      {
        name: 'ENTRA_APP_CLIENT_CERTIFICATE_NAME'
        value: 'o365-management-api-appreg-certificate'
      }
      {
        name: 'ENTRA_APP_CLIENT_CERTIFICATE_KEYVAULT_NAME'
        value: keyVault.outputs.name
      }
      {
        name: 'ENTRA_TENANT_ID'
        value: tenant().tenantId
      }
      {
        name: 'O365_MANAGEMENT_API'
        value: 'https://manage.office.com'
      }
      {
        name: 'O365_EVENT_TYPES'
        value: ''
      }
      {
        name: 'O365_IGNORED_SOURCES'
        value: ''
      }
      {
        name: 'EventHub__fullyQualifiedNamespace'
        value: eventHub.outputs.fullyQualifiedNamespace
      }
      {
        name: 'EVENT_HUB_NAME'
        value: eventHubName
      }
      {
        name: 'INDEXER_SCHEDULE'
        value: ''
      }
    ]
  }
}

module applicationInsights './appinsights.bicep' = {
  name: 'appinsights'
  params: {
    name: '${prefix}-insights'
    location: location
    tags: tags
  }
}

module eventHub './eventhubs.bicep' = {
  name: 'eventHub'
  params: {
    namespace: '${prefix}-eventhubs-ns'
    name: eventHubName
    location: location
    tags: tags
  }
}

module keyVault './keyvault.bicep' = {
  name: 'keyVault'
  params: {
    name: take('${prefix}-kv', 24)
    location: location
    tags: tags
  }
}

// Storage Blob Data Owner
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, storageBlobDataOwnerRoleId)
  properties: {
    principalId: indexerFunctionApp.outputs.principalId
    roleDefinitionId: storageBlobDataOwnerRoleId
  }
  scope: storageAccount
}

// Event Hubs Data Sender
resource eventHubRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, eventHubDataSenderRoleId)
  properties: {
    principalId: indexerFunctionApp.outputs.principalId
    roleDefinitionId: eventHubDataSenderRoleId
  }
}

// Monitoring Metrics Publisher
resource metricsPublisherRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, metricsPublisherRoleId)
  properties: {
    principalId: indexerFunctionApp.outputs.principalId
    roleDefinitionId: metricsPublisherRoleId
  }
}

// Key Vault Certificate User
resource keyvaultCertificateUserRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, keyvaultCertificateUserRoleId)
  properties: {
    principalId: indexerFunctionApp.outputs.principalId
    roleDefinitionId: keyvaultCertificateUserRoleId
  }
}

// Key Vault Certificates Officer
resource keyvaultCertificateOfficerRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, keyvaultCertificateOfficerRoleId)
  properties: {
    principalId: principalId
    principalType: principalType
    roleDefinitionId: keyvaultCertificateOfficerRoleId
  }
}
