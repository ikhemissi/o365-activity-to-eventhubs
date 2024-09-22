const { app, input, output } = require('@azure/functions');
const O365Client = require('../o365/O365Client');

const blobInput = input.storageBlob({
    path: 'o365state/last_successfull_fetch_on',
    connection: 'AzureWebJobsStorage',
});

const blobOutput = output.storageBlob({
    path: 'o365state/last_successfull_fetch_on',
    connection: 'AzureWebJobsStorage',
});

const eventHubOutput = output.eventHub({
    eventHubName: process.env.EVENT_HUB_NAME || 'o365events',
    connection: 'EventHub',
});

app.timer('eventindexer', {
    schedule: '0 */5 * * * *',
    extraInputs: [blobInput],
    extraOutputs: [eventHubOutput],
    return: blobOutput,
    handler: async (myTimer, context) => {
        const now = new Date();
        const lastSuccessDateRaw = context.extraInputs.get(blobInput);
        const lastSuccessDate = lastSuccessDateRaw ? new Date(lastSuccessDateRaw) : new Date(now.getTime() - 24 * 3600 * 1000); // fallback to 24 hours ago

        const client = new O365Client();
        const startTime = lastSuccessDate.toISOString().split('.')[0];
        const endTime = now.toISOString().split('.')[0];

        context.log(`Fetching o365 events between ${startTime} and ${endTime}`);	

        try {
            const events = await client.getActivityFeedEvents(startTime, endTime);

            // TODO: check if events can be objects or if they must be strings
            context.extraOutputs.set(eventHubOutput, events);
        } catch (error) {
            context.log.error(`Error fetching o365 events between ${startTime} and ${endTime}: ${error}`);
        }

        return `${now.toISOString()}`; // new success date
    },
});
