/**
 * Slack Integration Client
 *
 * Uses @slack/web-api to interact with Slack API.
 * Requires user to create a Slack App and provide a Bot Token.
 */

const { WebClient } = require('@slack/web-api');

let slackClient = null;
let currentToken = null;

/**
 * Initialize the Slack client with a bot token
 * @param {string} token - Slack Bot Token (xoxb-...)
 * @returns {WebClient} - Initialized Slack client
 */
function initSlack(token) {
    if (token === currentToken && slackClient) {
        return slackClient;
    }
    slackClient = new WebClient(token);
    currentToken = token;
    return slackClient;
}

/**
 * Get the current Slack client (or null if not initialized)
 */
function getSlackClient() {
    return slackClient;
}

/**
 * Check if Slack is connected
 */
function isConnected() {
    return slackClient !== null && currentToken !== null;
}

/**
 * Disconnect and clear credentials
 */
function disconnect() {
    slackClient = null;
    currentToken = null;
}

/**
 * Test the connection by fetching auth info
 */
async function testConnection(token) {
    try {
        const testClient = new WebClient(token);
        const response = await testClient.auth.test();
        return {
            success: true,
            team: response.team,
            user: response.user,
            bot_id: response.bot_id
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================================================
// SLACK API OPERATIONS
// ============================================================================

/**
 * Send a message to a channel or user
 * @param {string} channel - Channel name (with or without #) or channel ID
 * @param {string} text - Message text
 * @param {object} options - Optional message options (blocks, attachments, etc.)
 */
async function sendMessage(channel, text, options = {}) {
    if (!slackClient) throw new Error('Slack not connected. Please add your Slack Bot Token in Settings.');

    // Normalize channel name (remove # if present)
    const channelName = channel.startsWith('#') ? channel.slice(1) : channel;

    // Try to find channel ID if a name was provided
    let channelId = channelName;
    if (!channelName.startsWith('C') && !channelName.startsWith('D') && !channelName.startsWith('G')) {
        const channels = await listChannels();
        const found = channels.find(c =>
            c.name.toLowerCase() === channelName.toLowerCase()
        );
        if (found) {
            channelId = found.id;
        }
    }

    const response = await slackClient.chat.postMessage({
        channel: channelId,
        text: text,
        ...options
    });

    return {
        success: true,
        ts: response.ts,
        channel: response.channel,
        message: response.message?.text
    };
}

/**
 * List all channels the bot has access to
 * @param {object} options - Optional filter options
 */
async function listChannels(options = {}) {
    if (!slackClient) throw new Error('Slack not connected. Please add your Slack Bot Token in Settings.');

    const response = await slackClient.conversations.list({
        types: options.types || 'public_channel,private_channel',
        limit: options.limit || 100,
        exclude_archived: options.exclude_archived !== false
    });

    return response.channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        is_private: channel.is_private,
        is_member: channel.is_member,
        topic: channel.topic?.value,
        purpose: channel.purpose?.value,
        num_members: channel.num_members
    }));
}

/**
 * List users in the workspace
 * @param {object} options - Optional filter options
 */
async function listUsers(options = {}) {
    if (!slackClient) throw new Error('Slack not connected. Please add your Slack Bot Token in Settings.');

    const response = await slackClient.users.list({
        limit: options.limit || 100
    });

    return response.members
        .filter(user => !user.deleted && !user.is_bot)
        .map(user => ({
            id: user.id,
            name: user.name,
            real_name: user.real_name,
            display_name: user.profile?.display_name,
            email: user.profile?.email,
            status_text: user.profile?.status_text,
            status_emoji: user.profile?.status_emoji
        }));
}

/**
 * Get channel history (recent messages)
 * @param {string} channel - Channel ID or name
 * @param {object} options - Optional filter options
 */
async function getChannelHistory(channel, options = {}) {
    if (!slackClient) throw new Error('Slack not connected. Please add your Slack Bot Token in Settings.');

    // Normalize channel name
    const channelName = channel.startsWith('#') ? channel.slice(1) : channel;

    // Try to find channel ID if a name was provided
    let channelId = channelName;
    if (!channelName.startsWith('C') && !channelName.startsWith('D') && !channelName.startsWith('G')) {
        const channels = await listChannels();
        const found = channels.find(c =>
            c.name.toLowerCase() === channelName.toLowerCase()
        );
        if (found) {
            channelId = found.id;
        }
    }

    const response = await slackClient.conversations.history({
        channel: channelId,
        limit: options.limit || 20
    });

    return response.messages.map(msg => ({
        ts: msg.ts,
        user: msg.user,
        text: msg.text,
        type: msg.type,
        thread_ts: msg.thread_ts
    }));
}

/**
 * Search messages
 * @param {string} query - Search query
 * @param {object} options - Optional search options
 */
async function searchMessages(query, options = {}) {
    if (!slackClient) throw new Error('Slack not connected. Please add your Slack Bot Token in Settings.');

    const response = await slackClient.search.messages({
        query: query,
        count: options.limit || 20,
        sort: options.sort || 'timestamp',
        sort_dir: options.sort_dir || 'desc'
    });

    return {
        total: response.messages?.total || 0,
        matches: (response.messages?.matches || []).map(match => ({
            text: match.text,
            user: match.user,
            channel: match.channel?.name,
            ts: match.ts,
            permalink: match.permalink
        }))
    };
}

/**
 * React to a message with an emoji
 * @param {string} channel - Channel ID
 * @param {string} timestamp - Message timestamp
 * @param {string} emoji - Emoji name (without colons)
 */
async function addReaction(channel, timestamp, emoji) {
    if (!slackClient) throw new Error('Slack not connected. Please add your Slack Bot Token in Settings.');

    await slackClient.reactions.add({
        channel: channel,
        timestamp: timestamp,
        name: emoji.replace(/:/g, '')
    });

    return { success: true };
}

/**
 * Upload a file to a channel
 * @param {string} channel - Channel ID or name
 * @param {Buffer|string} content - File content
 * @param {object} options - File options (filename, title, etc.)
 */
async function uploadFile(channel, content, options = {}) {
    if (!slackClient) throw new Error('Slack not connected. Please add your Slack Bot Token in Settings.');

    const response = await slackClient.files.uploadV2({
        channel_id: channel,
        content: content,
        filename: options.filename || 'file.txt',
        title: options.title,
        initial_comment: options.comment
    });

    return {
        success: true,
        file: response.file
    };
}

/**
 * Set user status
 * @param {string} text - Status text
 * @param {string} emoji - Status emoji (with colons)
 */
async function setStatus(text, emoji = '') {
    if (!slackClient) throw new Error('Slack not connected. Please add your Slack Bot Token in Settings.');

    await slackClient.users.profile.set({
        profile: {
            status_text: text,
            status_emoji: emoji
        }
    });

    return { success: true };
}

module.exports = {
    initSlack,
    getSlackClient,
    isConnected,
    disconnect,
    testConnection,
    sendMessage,
    listChannels,
    listUsers,
    getChannelHistory,
    searchMessages,
    addReaction,
    uploadFile,
    setStatus
};
