/**
 * Discord Integration Client
 *
 * Uses discord.js to interact with Discord API.
 * Requires user to create a Discord Bot and provide the token.
 */

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

let discordClient = null;
let currentToken = null;
let isReady = false;

/**
 * Initialize the Discord client with a bot token
 * @param {string} token - Discord Bot Token
 * @returns {Promise<Client>} - Initialized Discord client
 */
async function initDiscord(token) {
    if (token === currentToken && discordClient && isReady) {
        return discordClient;
    }

    // Destroy existing client if any
    if (discordClient) {
        await discordClient.destroy();
    }

    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.DirectMessages
        ]
    });

    return new Promise((resolve, reject) => {
        discordClient.once('ready', () => {
            console.log(`[Discord] Logged in as ${discordClient.user.tag}`);
            currentToken = token;
            isReady = true;
            resolve(discordClient);
        });

        discordClient.once('error', (error) => {
            reject(error);
        });

        discordClient.login(token).catch(reject);
    });
}

/**
 * Get the current Discord client (or null if not initialized)
 */
function getDiscordClient() {
    return discordClient;
}

/**
 * Check if Discord is connected
 */
function isConnected() {
    return discordClient !== null && isReady;
}

/**
 * Disconnect and clear credentials
 */
async function disconnect() {
    if (discordClient) {
        await discordClient.destroy();
    }
    discordClient = null;
    currentToken = null;
    isReady = false;
}

/**
 * Test the connection using REST API (doesn't require full client)
 */
async function testConnection(token) {
    try {
        const rest = new REST({ version: '10' }).setToken(token);
        const user = await rest.get(Routes.user('@me'));
        return {
            success: true,
            username: user.username,
            id: user.id,
            discriminator: user.discriminator
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================================================
// DISCORD API OPERATIONS
// ============================================================================

/**
 * Send a message to a channel
 * @param {string} channelId - The channel ID
 * @param {string} content - Message content
 * @param {object} options - Optional message options
 */
async function sendMessage(channelId, content, options = {}) {
    if (!discordClient || !isReady) {
        throw new Error('Discord not connected. Please add your Discord Bot Token in Settings.');
    }

    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
        throw new Error('Channel not found or is not a text channel');
    }

    const message = await channel.send({
        content: content,
        ...options
    });

    return {
        success: true,
        id: message.id,
        channel: channel.name,
        content: message.content
    };
}

/**
 * List all servers (guilds) the bot is in
 */
async function listServers() {
    if (!discordClient || !isReady) {
        throw new Error('Discord not connected. Please add your Discord Bot Token in Settings.');
    }

    return discordClient.guilds.cache.map(guild => ({
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
        ownerId: guild.ownerId
    }));
}

/**
 * List channels in a server
 * @param {string} guildId - The server ID
 * @param {object} options - Optional filter options
 */
async function listChannels(guildId, options = {}) {
    if (!discordClient || !isReady) {
        throw new Error('Discord not connected. Please add your Discord Bot Token in Settings.');
    }

    const guild = await discordClient.guilds.fetch(guildId);
    if (!guild) throw new Error('Server not found');

    const channels = await guild.channels.fetch();

    return channels
        .filter(c => c && (!options.type || c.type === options.type))
        .map(channel => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parent: channel.parent?.name,
            position: channel.position
        }));
}

/**
 * Get channel messages
 * @param {string} channelId - The channel ID
 * @param {object} options - Optional filter options
 */
async function getMessages(channelId, options = {}) {
    if (!discordClient || !isReady) {
        throw new Error('Discord not connected. Please add your Discord Bot Token in Settings.');
    }

    const channel = await discordClient.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
        throw new Error('Channel not found or is not a text channel');
    }

    const messages = await channel.messages.fetch({
        limit: options.limit || 20
    });

    return messages.map(msg => ({
        id: msg.id,
        author: msg.author.username,
        content: msg.content,
        createdAt: msg.createdAt,
        attachments: msg.attachments.map(a => a.url)
    }));
}

/**
 * React to a message
 * @param {string} channelId - The channel ID
 * @param {string} messageId - The message ID
 * @param {string} emoji - The emoji to react with
 */
async function addReaction(channelId, messageId, emoji) {
    if (!discordClient || !isReady) {
        throw new Error('Discord not connected. Please add your Discord Bot Token in Settings.');
    }

    const channel = await discordClient.channels.fetch(channelId);
    const message = await channel.messages.fetch(messageId);
    await message.react(emoji);

    return { success: true };
}

/**
 * Get server info
 * @param {string} guildId - The server ID
 */
async function getServerInfo(guildId) {
    if (!discordClient || !isReady) {
        throw new Error('Discord not connected. Please add your Discord Bot Token in Settings.');
    }

    const guild = await discordClient.guilds.fetch(guildId);
    if (!guild) throw new Error('Server not found');

    return {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        createdAt: guild.createdAt,
        description: guild.description
    };
}

/**
 * Send a DM to a user
 * @param {string} userId - The user ID
 * @param {string} content - Message content
 */
async function sendDM(userId, content) {
    if (!discordClient || !isReady) {
        throw new Error('Discord not connected. Please add your Discord Bot Token in Settings.');
    }

    const user = await discordClient.users.fetch(userId);
    if (!user) throw new Error('User not found');

    const dmChannel = await user.createDM();
    const message = await dmChannel.send(content);

    return {
        success: true,
        id: message.id,
        content: message.content
    };
}

module.exports = {
    initDiscord,
    getDiscordClient,
    isConnected,
    disconnect,
    testConnection,
    sendMessage,
    listServers,
    listChannels,
    getMessages,
    addReaction,
    getServerInfo,
    sendDM
};
