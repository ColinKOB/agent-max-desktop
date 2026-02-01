/**
 * Third-Party Integrations
 *
 * Export all integration clients for use in the main process and executor.
 */

const notionClient = require('./notionClient.cjs');
const slackClient = require('./slackClient.cjs');
const discordClient = require('./discordClient.cjs');
const hubspotClient = require('./hubspotClient.cjs');
const zendeskClient = require('./zendeskClient.cjs');

module.exports = {
    notionClient,
    slackClient,
    discordClient,
    hubspotClient,
    zendeskClient
};
