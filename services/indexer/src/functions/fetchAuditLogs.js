const { app, input, output } = require('@azure/functions');
const O365ManagementApiClient = require('../o365/O365ManagementApiClient');

const {
    AUDIT_LOGS_EVENT_HUB_NAME,
    AUDIT_LOGS_INDEXER_SCHEDULE,
} = process.env;

const blobInput = input.storageBlob({
    path: 'auditlogstate/last_successfull_fetch_on',
    connection: 'AzureWebJobsStorage',
});

const blobOutput = output.storageBlob({
    path: 'auditlogstate/last_successfull_fetch_on',
    connection: 'AzureWebJobsStorage',
});

const eventHubOutput = output.eventHub({
    eventHubName: AUDIT_LOGS_EVENT_HUB_NAME || 'securityevents',
    connection: 'EventHub',
});

app.timer('fetchAuditLogs', {
    schedule: AUDIT_LOGS_INDEXER_SCHEDULE || '0 */5 * * * *', // fallback to running every 5 minutes
    extraInputs: [blobInput],
    extraOutputs: [eventHubOutput],
    return: blobOutput,
    handler: async (myTimer, context) => {
        const now = new Date();
        const lastSuccessDateRaw = context.extraInputs.get(blobInput);
        const lastSuccessDate = lastSuccessDateRaw ? new Date(lastSuccessDateRaw) : new Date(now.getTime() - 24 * 3600 * 1000); // fallback to 24 hours ago

        const client = new O365ManagementApiClient();
        const startTime = lastSuccessDate.toISOString().split('.')[0];
        const endTime = now.toISOString().split('.')[0];

        context.info(`Fetching o365 events between ${startTime} and ${endTime}`);	

        try {
            const events = await client.getActivityFeedEvents(startTime, endTime);

            context.extraOutputs.set(eventHubOutput, events);

            context.info(`${events.length} o365 events were found between ${startTime} and ${endTime}`);
        } catch (error) {
            context.error(`Error fetching o365 events between ${startTime} and ${endTime}: ${error.message}`);
        }

        return `${now.toISOString()}`; // new success date
    },
});
