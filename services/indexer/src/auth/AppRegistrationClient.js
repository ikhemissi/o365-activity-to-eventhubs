const { X509Certificate } = require('node:crypto');
const { ProxyAgent } = require('undici');
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const HttpClientWithProxy = require('./HttpClientWithProxy');

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
    this.proxyUri = proxyUri;

    if (proxyUri) {
        const proxyOptions = {
            uri: proxyUri,
        };

        if (proxyToken) {
            proxyOptions.token = proxyToken;
        }

        this.proxy = new ProxyAgent(proxyOptions);
    }
  }

  async getCCA() {
    if (this.cca) {
        return this.cca;
    }

    const secretClient = new SecretClient(`https://${this.vaultName}.vault.azure.net`, new DefaultAzureCredential());
    
    const certificateSecret = await secretClient.getSecret(this.certificateName);

    const privateKey = certificateSecret?.value.split('-----BEGIN CERTIFICATE-----\n')[0];

    if (!privateKey) {
      throw new Error(`Failed to retrieve private key. The key is empty or invalid.`);
    }
    
    const x509Certificate = new X509Certificate(certificateSecret?.value);
    
    const ccaConfig = {
      auth: {
        clientId: this.clientId,
        authority: `${this.loginUrl}/${this.tenantId}`,
        clientCertificate: {
            thumbprint: x509Certificate.fingerprint.replace(/:/g, ''),
            privateKey: privateKey,
        },
      },
    };

    if (this.proxyUri) {
      ccaConfig.system = {
          networkClient: new HttpClientWithProxy(this.proxyUri),
      };
    }

    this.cca = new ConfidentialClientApplication(ccaConfig);

    return this.cca;
  }
  
  async getToken() {
    try {
      const cca = await this.getCCA();
      return await cca.acquireTokenByClientCredential({scopes: this.scopes});
    }
    catch (error) {
      throw new Error(`Failed to retrieve token. Error: ${error.message}`);
    }
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
