const { app, input, output } = require('@azure/functions');
const ExchangeMessageTraceClient = require('../o365/ExchangeMessageTraceClient');

const {
    MESSAGE_TRACES_EVENT_HUB_NAME,
    MESSAGE_TRACES_INDEXER_SCHEDULE,
} = process.env;

const blobInput = input.storageBlob({
    path: 'messagetracestate/last_successfull_fetch_on',
    connection: 'AzureWebJobsStorage',
});

const blobOutput = output.storageBlob({
    path: 'messagetracestate/last_successfull_fetch_on',
    connection: 'AzureWebJobsStorage',
});

const eventHubOutput = output.eventHub({
    eventHubName: MESSAGE_TRACES_EVENT_HUB_NAME || 'securityevents',
    connection: 'EventHub',
});

app.timer('fetchMessageTraces', {
    schedule: MESSAGE_TRACES_INDEXER_SCHEDULE || '0 */5 * * * *', // fallback to running every 5 minutes
    extraInputs: [blobInput],
    extraOutputs: [eventHubOutput],
    return: blobOutput,
    handler: async (myTimer, context) => {
        const now = new Date();
        const lastSuccessDateRaw = context.extraInputs.get(blobInput);
        const lastSuccessDate = lastSuccessDateRaw ? new Date(lastSuccessDateRaw) : new Date(now.getTime() - 24 * 3600 * 1000); // fallback to 24 hours ago

        const client = new ExchangeMessageTraceClient();
        const startTime = lastSuccessDate.toISOString().split('.')[0];
        const endTime = now.toISOString().split('.')[0];

        context.info(`Fetching message traces between ${startTime} and ${endTime}`);	

        try {
            const events = await client.getMessageTraces(startTime, endTime);

            context.extraOutputs.set(eventHubOutput, events);

            context.info(`${events.length} message traces were found between ${startTime} and ${endTime}`);
        } catch (error) {
            context.error(`Error fetching message traces between ${startTime} and ${endTime}: ${error.message}`);
        }

        return `${now.toISOString()}`; // new success date
    },
});
