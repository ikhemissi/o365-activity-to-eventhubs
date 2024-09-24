const msal = require('@azure/msal-node');

const {
    ENTRA_CLIENT_ID,
    ENTRA_CLIENT_SECRET,
    ENTRA_LOGIN_URL,
    ENTRA_TENANT_ID,
    O365_MANAGEMENT_API,
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

class O365Client {
    constructor() {
        this.eventTypes = this.getEventTypes();
        this.ignoredSources = this.getIgnoredSources();
        this.publisher = ENTRA_TENANT_ID;
        this.cca = new msal.ConfidentialClientApplication({
            auth: {
                clientId: ENTRA_CLIENT_ID,
                authority: `${ENTRA_LOGIN_URL}/${ENTRA_TENANT_ID}`,
                clientSecret: ENTRA_CLIENT_SECRET,
           }
        });
    }

    // expected date format is yyyy-MM-ddTHH:mm:ss
    async getActivityFeedEvents(startTime, endTime) {
        const events = [];
    
        for (const eventType of this.eventTypes) {
            let eventListUri = this.activityEndpointUrl(`/subscriptions/content?contentType=${eventType}&startTime=${startTime}&endTime=${endTime}&PublisherIdentifier=${this.publisher}`);

            while (eventListUri !== null) {
                const {headers, data: availableContent} = await this.request(eventListUri);
    
                // https://learn.microsoft.com/en-us/office/office-365-management-api/office-365-management-activity-api-reference#pagination
                eventListUri = headers.get('NextPageUri') || headers.get('NextPageUrl') || null;
    
                for (const content of availableContent) {
                    const {data: contentEvents} = await this.request(content.contentUri);

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
        const {data} = await this.request(subscriptionListUri);
    
        return data;
    }

    async subscribeToEvents() {
        const results = [];
    
        for (const eventType of this.eventTypes) {
            const eventTypeSubscriptionUri = this.activityEndpointUrl(`/subscriptions/start?contentType=${eventType}&PublisherIdentifier=${this.publisher}`);
            const {data} = await this.request(eventTypeSubscriptionUri, 'POST');
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

    async getAccessToken() {
        const tokenRequest = {
            scopes: [
                `${O365_MANAGEMENT_API}/.default`
            ],
        };
        
        return this.cca.acquireTokenByClientCredential(tokenRequest);
    }

    activityEndpointUrl(endpoint) {
        return `${O365_MANAGEMENT_API}/api/v1.0/${ENTRA_TENANT_ID}/activity/feed${endpoint}`;
    }

    async request(url, method = 'GET', body = null) {
        const token = await this.getAccessToken();
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

        const response = await fetch(url, options);
        return {
            data: await response.json(),
            headers: response.headers,
        };
    }
}

module.exports = O365Client;