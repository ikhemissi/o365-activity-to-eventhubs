const AppRegistrationClient = require('../auth/AppRegistrationClient');

const {
    ENTRA_APP_CLIENT_ID,
    ENTRA_APP_CLIENT_CERTIFICATE_NAME,
    ENTRA_APP_CLIENT_CERTIFICATE_KEYVAULT_NAME,
    ENTRA_TENANT_ID,
    APP_PROXY_URI,
    APP_PROXY_TOKEN,
    O365_MANAGEMENT_API = 'https://manage.office.com',
    O365_EVENT_TYPES,
    O365_IGNORED_SOURCES,
} = process.env;

function extractArrayFromEnvVariable(commaSeparatedString, defaultValue = []) {
    let array = (commaSeparatedString || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    if (!array.length) {
        array = defaultValue;
    }

    return array;
}

class O365ManagementApiClient {
    constructor() {
        this.eventTypes = this.getEventTypes();
        this.ignoredSources = this.getIgnoredSources();
        this.publisher = ENTRA_TENANT_ID;
        this.appRegistrationClient = new AppRegistrationClient({
            clientId: ENTRA_APP_CLIENT_ID,
            tenantId: ENTRA_TENANT_ID,
            vaultName: ENTRA_APP_CLIENT_CERTIFICATE_KEYVAULT_NAME,
            certificateName: ENTRA_APP_CLIENT_CERTIFICATE_NAME,
            scopes: [
                `${O365_MANAGEMENT_API}/.default`
            ],
            proxyUri: APP_PROXY_URI,
            proxyToken: APP_PROXY_TOKEN,
        });
    }

    // expected date format is yyyy-MM-ddTHH:mm:ss
    async getActivityFeedEvents(startTime, endTime) {
        const events = [];
    
        for (const eventType of this.eventTypes) {
            let eventListUri = this.activityEndpointUrl(`/subscriptions/content?contentType=${eventType}&startTime=${startTime}&endTime=${endTime}&PublisherIdentifier=${this.publisher}`);

            while (eventListUri !== null) {
                const {headers, data: availableContent} = await this.appRegistrationClient.request(eventListUri);
    
                // https://learn.microsoft.com/en-us/office/office-365-management-api/office-365-management-activity-api-reference#pagination
                eventListUri = headers.get('NextPageUri') || headers.get('NextPageUrl') || null;
    
                for (const content of availableContent) {
                    const {data: contentEvents} = await this.appRegistrationClient.request(content.contentUri);

                    for (const event of contentEvents) {    
                        if (!this.ignoredSources.includes(event.Source)) {
                            events.push(event);
                        }
                    }
                }
            }
        }
    
        return events;
    }

    async listSubscriptions() {
        const subscriptionListUri = this.activityEndpointUrl(`/subscriptions/list?PublisherIdentifier=${this.publisher}`);
        const {data} = await this.appRegistrationClient.request(subscriptionListUri);
    
        return data;
    }

    async subscribeToEvents() {
        const results = [];
    
        for (const eventType of this.eventTypes) {
            const eventTypeSubscriptionUri = this.activityEndpointUrl(`/subscriptions/start?contentType=${eventType}&PublisherIdentifier=${this.publisher}`);
            const {data} = await this.appRegistrationClient.request(eventTypeSubscriptionUri, 'POST');
            results.push(data);
        }
    
        return results;
    }

    getEventTypes() {
        const defaultEventTypes = [
            'Audit.AzureActiveDirectory',
            'Audit.Exchange',
            'Audit.SharePoint',
            'Audit.General',
            'DLP.All',
        ];

        return extractArrayFromEnvVariable(O365_EVENT_TYPES, defaultEventTypes);
    }

    getIgnoredSources() {
        const defaultIgnoredSources = [
            'Cloud App Security',
        ];

        return extractArrayFromEnvVariable(O365_IGNORED_SOURCES, defaultIgnoredSources);
    }

    activityEndpointUrl(endpoint) {
        return `${O365_MANAGEMENT_API}/api/v1.0/${ENTRA_TENANT_ID}/activity/feed${endpoint}`;
    }
}

module.exports = O365ManagementApiClient;