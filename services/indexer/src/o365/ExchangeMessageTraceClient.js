const AppRegistrationClient = require('../auth/AppRegistrationClient');

const {
    ENTRA_APP_CLIENT_ID,
    ENTRA_APP_CLIENT_CERTIFICATE_NAME,
    ENTRA_APP_CLIENT_CERTIFICATE_KEYVAULT_NAME,
    ENTRA_TENANT_ID,
    APP_PROXY_URI,
    APP_PROXY_TOKEN,
    EXCHANGE_REPORTING_API = 'https://reports.office365.com/ecp/reportingwebservice/reporting.svc',
    EXCHANGE_REPORTING_SCOPE = 'https://outlook.office365.com/.default',
} = process.env;

class ExchangeMessageTraceClient {
    constructor() {
        this.appRegistrationClient = new AppRegistrationClient({
            clientId: ENTRA_APP_CLIENT_ID,
            tenantId: ENTRA_TENANT_ID,
            vaultName: ENTRA_APP_CLIENT_CERTIFICATE_KEYVAULT_NAME,
            certificateName: ENTRA_APP_CLIENT_CERTIFICATE_NAME,
            scopes: [
                EXCHANGE_REPORTING_SCOPE,
            ],
            proxyUri: APP_PROXY_URI,
            proxyToken: APP_PROXY_TOKEN,
        });
    }

    // expected date format is yyyy-MM-ddTHH:mm:ss
    async getMessageTraces(startTime, endTime) {    
          // https://learn.microsoft.com/en-us/previous-versions/office/developer/o365-enterprise-developers/jj984335(v=office.15)
        const messageTraceListUri = `${EXCHANGE_REPORTING_API}/MessageTrace?$format=Json&$filter=${encodeURIComponent(`StartDate eq datetime'${startTime}' and EndDate eq datetime'${endTime}'`)}`;
        const {data: messageTraces} = await this.appRegistrationClient.request(messageTraceListUri);

        return messageTraces.d?.results || [];
    }
}

module.exports = ExchangeMessageTraceClient;