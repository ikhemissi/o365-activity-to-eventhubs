param namespace string
param name string
param location string = resourceGroup().location
param tags object = {}

resource eventHubNamespace 'Microsoft.EventHub/namespaces@2021-11-01' = {
  name: namespace
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  tags: tags
}

resource eventHub 'Microsoft.EventHub/namespaces/eventHubs@2021-11-01' = {
  parent: eventHubNamespace
  name: name
  properties: {
    messageRetentionInDays: 7
    partitionCount: 2
  }
}

output fullyQualifiedNamespace string = '${eventHubNamespace.name}.servicebus.windows.net'
