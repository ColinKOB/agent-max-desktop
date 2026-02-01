/**
 * Zendesk Integration Client
 *
 * Uses node-zendesk to interact with Zendesk Support API.
 * Requires user to provide subdomain and API token.
 */

const zendesk = require('node-zendesk');

let zendeskClient = null;
let currentConfig = null;

/**
 * Initialize the Zendesk client
 * @param {object} config - Zendesk configuration
 * @param {string} config.subdomain - Your Zendesk subdomain (e.g., 'company' for company.zendesk.com)
 * @param {string} config.email - Your Zendesk email
 * @param {string} config.token - Your Zendesk API token
 * @returns {object} - Initialized Zendesk client
 */
function initZendesk(config) {
    const configKey = `${config.subdomain}:${config.email}`;
    if (configKey === currentConfig && zendeskClient) {
        return zendeskClient;
    }

    zendeskClient = zendesk.createClient({
        username: config.email,
        token: config.token,
        remoteUri: `https://${config.subdomain}.zendesk.com/api/v2`
    });

    currentConfig = configKey;
    return zendeskClient;
}

/**
 * Get the current Zendesk client (or null if not initialized)
 */
function getZendeskClient() {
    return zendeskClient;
}

/**
 * Check if Zendesk is connected
 */
function isConnected() {
    return zendeskClient !== null && currentConfig !== null;
}

/**
 * Disconnect and clear credentials
 */
function disconnect() {
    zendeskClient = null;
    currentConfig = null;
}

/**
 * Test the connection by fetching current user
 */
async function testConnection(config) {
    try {
        const testClient = zendesk.createClient({
            username: config.email,
            token: config.token,
            remoteUri: `https://${config.subdomain}.zendesk.com/api/v2`
        });

        return new Promise((resolve, reject) => {
            testClient.users.me((err, req, result) => {
                if (err) {
                    resolve({
                        success: false,
                        error: err.message
                    });
                } else {
                    resolve({
                        success: true,
                        user: result.name,
                        email: result.email,
                        role: result.role
                    });
                }
            });
        });
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================================================
// ZENDESK API OPERATIONS
// ============================================================================

/**
 * Promisify a Zendesk client method
 */
function promisify(fn, ...args) {
    return new Promise((resolve, reject) => {
        fn(...args, (err, req, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
}

/**
 * List tickets
 * @param {object} options - Optional filter options
 */
async function listTickets(options = {}) {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    let tickets;
    if (options.status) {
        // Use search for filtered results
        const query = `type:ticket status:${options.status}`;
        const results = await promisify(zendeskClient.search.query.bind(zendeskClient.search), query);
        tickets = results.slice(0, options.limit || 100);
    } else {
        tickets = await promisify(zendeskClient.tickets.list.bind(zendeskClient.tickets));
        if (options.limit) {
            tickets = tickets.slice(0, options.limit);
        }
    }

    return tickets.map(ticket => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        type: ticket.type,
        requester_id: ticket.requester_id,
        assignee_id: ticket.assignee_id,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at
    }));
}

/**
 * Get a specific ticket
 * @param {number} ticketId - The ticket ID
 */
async function getTicket(ticketId) {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    const ticket = await promisify(zendeskClient.tickets.show.bind(zendeskClient.tickets), ticketId);

    // Get comments for the ticket
    let comments = [];
    try {
        comments = await promisify(zendeskClient.tickets.getComments.bind(zendeskClient.tickets), ticketId);
    } catch (e) {
        // Comments might not be available
    }

    return {
        id: ticket.id,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        type: ticket.type,
        requester_id: ticket.requester_id,
        assignee_id: ticket.assignee_id,
        tags: ticket.tags,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        comments: comments.map(c => ({
            id: c.id,
            body: c.body,
            author_id: c.author_id,
            created_at: c.created_at,
            public: c.public
        }))
    };
}

/**
 * Search tickets
 * @param {string} query - Search query
 * @param {object} options - Optional search options
 */
async function searchTickets(query, options = {}) {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    const searchQuery = `type:ticket ${query}`;
    const results = await promisify(zendeskClient.search.query.bind(zendeskClient.search), searchQuery);

    const tickets = results.slice(0, options.limit || 20);

    return {
        total: results.length,
        results: tickets.map(ticket => ({
            id: ticket.id,
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority,
            created_at: ticket.created_at
        }))
    };
}

/**
 * Create a ticket
 * @param {object} ticketData - Ticket data
 */
async function createTicket(ticketData) {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    const ticket = await promisify(zendeskClient.tickets.create.bind(zendeskClient.tickets), {
        ticket: {
            subject: ticketData.subject,
            comment: {
                body: ticketData.description || ticketData.body
            },
            priority: ticketData.priority || 'normal',
            type: ticketData.type || 'question',
            requester: ticketData.requester,
            tags: ticketData.tags
        }
    });

    return {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        url: `https://${currentConfig?.split(':')[0]}.zendesk.com/agent/tickets/${ticket.id}`
    };
}

/**
 * Update a ticket
 * @param {number} ticketId - The ticket ID
 * @param {object} updates - Updates to apply
 */
async function updateTicket(ticketId, updates) {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    const ticketUpdate = { ticket: {} };

    if (updates.status) ticketUpdate.ticket.status = updates.status;
    if (updates.priority) ticketUpdate.ticket.priority = updates.priority;
    if (updates.type) ticketUpdate.ticket.type = updates.type;
    if (updates.assignee_id) ticketUpdate.ticket.assignee_id = updates.assignee_id;
    if (updates.tags) ticketUpdate.ticket.tags = updates.tags;
    if (updates.comment) {
        ticketUpdate.ticket.comment = {
            body: updates.comment,
            public: updates.public !== false
        };
    }

    const ticket = await promisify(zendeskClient.tickets.update.bind(zendeskClient.tickets), ticketId, ticketUpdate);

    return {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status
    };
}

/**
 * Add a comment to a ticket
 * @param {number} ticketId - The ticket ID
 * @param {string} comment - Comment text
 * @param {boolean} isPublic - Whether the comment is public
 */
async function addComment(ticketId, comment, isPublic = true) {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    return updateTicket(ticketId, {
        comment: comment,
        public: isPublic
    });
}

/**
 * Get ticket stats/metrics
 */
async function getTicketStats() {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    const statuses = ['new', 'open', 'pending', 'hold', 'solved'];
    const stats = {};

    for (const status of statuses) {
        try {
            const results = await promisify(zendeskClient.search.query.bind(zendeskClient.search), `type:ticket status:${status}`);
            stats[status] = results.length;
        } catch (e) {
            stats[status] = 0;
        }
    }

    return stats;
}

/**
 * List users
 * @param {object} options - Optional filter options
 */
async function listUsers(options = {}) {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    let users = await promisify(zendeskClient.users.list.bind(zendeskClient.users));

    if (options.role) {
        users = users.filter(u => u.role === options.role);
    }

    if (options.limit) {
        users = users.slice(0, options.limit);
    }

    return users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        created_at: user.created_at
    }));
}

/**
 * Get a specific user
 * @param {number} userId - The user ID
 */
async function getUser(userId) {
    if (!zendeskClient) throw new Error('Zendesk not connected. Please add your Zendesk credentials in Settings.');

    const user = await promisify(zendeskClient.users.show.bind(zendeskClient.users), userId);

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        phone: user.phone,
        organization_id: user.organization_id,
        created_at: user.created_at,
        updated_at: user.updated_at
    };
}

module.exports = {
    initZendesk,
    getZendeskClient,
    isConnected,
    disconnect,
    testConnection,
    listTickets,
    getTicket,
    searchTickets,
    createTicket,
    updateTicket,
    addComment,
    getTicketStats,
    listUsers,
    getUser
};
