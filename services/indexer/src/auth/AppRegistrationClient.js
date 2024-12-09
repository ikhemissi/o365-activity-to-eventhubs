const { X509Certificate } = require('node:crypto');
const { ProxyAgent } = require('undici');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const { ConfidentialClientApplication } = require('@azure/msal-node');

class AppRegistrationClient {
  constructor({ clientId, tenantId, vaultName, certificateName, scopes = [], loginUrl = 'https://login.microsoftonline.com', proxyUri = '', proxyToken = '' }) {
    this.clientId = clientId;
    this.tenantId = tenantId;
    this.vaultName = vaultName;
    this.certificateName = certificateName;
    this.scopes = scopes;
    this.loginUrl = loginUrl;
    this.cca = null;
    this.proxy = null;
    if (proxyUri) {
        const proxyOptions = {
            uri: proxyUri,
        };

        if (proxyToken) {
            proxyOptions.token = proxyToken;
        }

        this.proxy = new ProxyAgent(proxyOptions)
    }
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

  async request(url, method = 'GET', body = null) {
    const token = await this.getToken();
    const options = {
        method,
        headers: {
            'Authorization': `${token.tokenType} ${token.accessToken}`
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
    }

    if (this.proxy) {
        options.dispatcher = this.proxy;
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Failed to fetch data from ${url}. Status: ${response.status}. Content: ${await response.text()}`);
    }

    let data = [];

    try {
        data = await response.json();
    }
    catch (error) {
        throw new Error(`Failed to parse response from ${url}. Error: ${error.message}`);
    }

    return {
        data,
        headers: response.headers,
    };
  }
}

module.exports = AppRegistrationClient;
