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

var resourceToken = toLower(uniqueString(subscription().id, name, location))
var tags = { 'azd-env-name': name }

var prefix = '${name}-${resourceToken}'

// https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#storage-blob-data-owner
var storageBlobDataOwnerRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b')
var storageFunctionRoleAssignment = guid(resourceGroup().id, storageBlobDataOwnerRoleId)

// https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#azure-event-hubs-data-sender
var eventHubDataSenderRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2b629674-e913-4c01-ae53-ef4638d8f975')
var eventHubFunctionRoleAssignment = guid(resourceGroup().id, eventHubDataSenderRoleId)

// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/monitor#monitoring-metrics-publisher
var metricsPublisherRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '3913510d-42f4-4e42-8a64-420c390055eb')
var appInsightsFunctionRoleAssignment = guid(resourceGroup().id, metricsPublisherRoleId)

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
        name: 'ENTRA_CLIENT_ID'
        value: ''
      }
      {
        name: 'ENTRA_CLIENT_SECRET'
        value: ''
      }
      {
        name: 'ENTRA_LOGIN_URL'
        value: 'https://login.microsoftonline.com'
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

// Storage Blob Data Owner
resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: storageFunctionRoleAssignment
  properties: {
    principalId: indexerFunctionApp.outputs.principalId
    roleDefinitionId: storageBlobDataOwnerRoleId
  }
  scope: storageAccount
}

// Event Hubs Data Sender
resource eventHubRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: eventHubFunctionRoleAssignment
  properties: {
    principalId: indexerFunctionApp.outputs.principalId
    roleDefinitionId: eventHubDataSenderRoleId
  }
}

// Monitoring Metrics Publisher
resource metricsPublisherRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: appInsightsFunctionRoleAssignment
  properties: {
    principalId: indexerFunctionApp.outputs.principalId
    roleDefinitionId: metricsPublisherRoleId
  }
}
