# o365-activity-to-eventhubs

Extract audit events from O365 management activity api and publish them to Event Hubs

## Pre-requisites

#### Azure subscription

You need an Azure subscription for deploying Event Hubs, Azure Functions, and other backing resources.

#### O365 App registration

An App registration which grants access to the O365 management api.
Please follow [this guide](https://learn.microsoft.com/en-us/office/office-365-management-api/get-started-with-office-365-management-apis) to create the App registration and to understand how the process works.

Once you have created the App Registration, please [upload a PEM certificate] to the App Registration's certificates(https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app?tabs=certificate#add-credentials) to allow authentication with certificates instead of secrets.
The Function App will fetch the certificate from a KeyVault, so you can either create it directly in the KeyVault, or you can [import an existing certificate](https://learn.microsoft.com/en-us/azure/key-vault/certificates/tutorial-import-certificate?tabs=azure-portal#import-a-certificate-to-your-key-vault) to it.

> [!IMPORTANT]  
> The Certificate must be in the PEM format

#### Development environment

You can use the provided Github codespace for a fast-start experience, it includes all the required tools.
Alternatively, you can install [azd](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/install-azd?tabs=winget-windows%2Cbrew-mac%2Cscript-linux&pivots=os-linux) locally and you should be good to go.

## Deploying the solution

Create the resources on Azure:

```bash
ENTRA_APP_CLIENT_ID=REPLACE_WITH_CLIENT_ID \
azd provision
```

Then make sure the PEM certificate exists in the KeyVault and it was added to the App Registration.

Finally deploy the code of the data indexing function:

```bash
azd deploy
```

Once the timer function gets triggered you should start getting new O365 audit events in Event Hubs.

## TODO

- [] Support Exchange Message Traces
- [] Better setup documentation
- [] Use KV to sign authentication claims
