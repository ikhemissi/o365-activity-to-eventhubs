const { X509Certificate } = require('node:crypto');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const { ConfidentialClientApplication } = require('@azure/msal-node');

class AppRegistrationClient {
  constructor({ clientId, tenantId, vaultName, certificateName, scopes = [], loginUrl = 'https://login.microsoftonline.com' }) {
    this.clientId = clientId;
    this.tenantId = tenantId;
    this.vaultName = vaultName;
    this.certificateName = certificateName;
    this.scopes = scopes;
    this.loginUrl = loginUrl;
    this.cca = null;
  }

  async getCCA() {
    if (this.cca) {
        return this.cca;
    }

    const secretClient = new SecretClient(`https://${this.vaultName}.vault.azure.net`, new DefaultAzureCredential());
    
    const certificateSecret = await secretClient.getSecret(this.certificateName);

    const privateKey = certificateSecret?.value.split('-----BEGIN CERTIFICATE-----\n')[0];
    const x509Certificate = new X509Certificate(certificateSecret?.value);
    
    this.cca = new ConfidentialClientApplication({
        auth: {
            clientId: this.clientId,
            authority: `${this.loginUrl}/${this.tenantId}`,
            clientCertificate: {
                thumbprint: x509Certificate.fingerprint.replace(/:/g, ''),
                privateKey: privateKey,
            },
        }
    });

    return this.cca;
  }
  
  async getToken() {
    const cca = await this.getCCA();
    return cca.acquireTokenByClientCredential({scopes: this.scopes});
  }
}

module.exports = AppRegistrationClient;
