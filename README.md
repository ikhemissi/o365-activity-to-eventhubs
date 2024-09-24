# o365-activity-to-eventhubs

Extract audit events from O365 management activity api and publish them to Event Hubs

## Pre-requisites

#### Azure subscription

You need an Azure subscription for deploying Event Hubs, Azure Functions, and other backing resources.

#### O365 App registration

An App registration which grants access to the O365 management api.
Please follow [this guide](https://learn.microsoft.com/en-us/office/office-365-management-api/get-started-with-office-365-management-apis) to create the App registration and to understand how the process works.

#### Development environment

You can use the provided Github codespace for a fast-start experience, it includes all the required tools.
Alternatively, you can install [azd](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd?tabs=winget-windows%2Cbrew-mac%2Cscript-linux&pivots=os-linux) locally and you should be good to go.

## Deploying the solution

Create the resources on Azure:

```bash
ENTRA_APP_CLIENT_ID=REPLACE_WITH_CLIENT_ID \
ENTRA_APP_CLIENT_SECRET=REPLACE_WITH_CLIENT_SECRET \
azd provision
```

Then deploy the code of the data indexing function:

```bash
azd deploy
```

Once the timer function gets triggered you should start getting new O365 audit events in Event Hubs.
