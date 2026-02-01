/**
 * Notion Integration Client
 *
 * Uses @notionhq/client to interact with Notion API.
 * Requires user to create an Internal Integration and provide the token.
 */

const { Client } = require('@notionhq/client');

let notionClient = null;
let currentToken = null;

/**
 * Initialize the Notion client with an API token
 * @param {string} token - Notion Internal Integration Token
 * @returns {Client} - Initialized Notion client
 */
function initNotion(token) {
    if (token === currentToken && notionClient) {
        return notionClient;
    }
    notionClient = new Client({ auth: token });
    currentToken = token;
    return notionClient;
}

/**
 * Get the current Notion client (or null if not initialized)
 */
function getNotionClient() {
    return notionClient;
}

/**
 * Check if Notion is connected
 */
function isConnected() {
    return notionClient !== null && currentToken !== null;
}

/**
 * Disconnect and clear credentials
 */
function disconnect() {
    notionClient = null;
    currentToken = null;
}

/**
 * Test the connection by fetching user info
 */
async function testConnection(token) {
    try {
        const testClient = new Client({ auth: token });
        const response = await testClient.users.me({});
        return {
            success: true,
            user: response.name || response.id,
            type: response.type
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================================================
// NOTION API OPERATIONS
// ============================================================================

/**
 * Search Notion for pages, databases, etc.
 * @param {string} query - Search query
 * @param {object} options - Optional filters
 */
async function search(query, options = {}) {
    if (!notionClient) throw new Error('Notion not connected. Please add your Notion API token in Settings.');

    const response = await notionClient.search({
        query,
        filter: options.filter,
        sort: options.sort,
        page_size: options.limit || 10
    });

    return response.results.map(item => ({
        id: item.id,
        type: item.object,
        title: getTitle(item),
        url: item.url,
        created_time: item.created_time,
        last_edited_time: item.last_edited_time
    }));
}

/**
 * Create a new page
 * @param {object} options - Page options
 */
async function createPage(options) {
    if (!notionClient) throw new Error('Notion not connected. Please add your Notion API token in Settings.');

    const { parentId, title, content, icon, cover } = options;

    // Determine parent type
    const parent = parentId.includes('-')
        ? { page_id: parentId }
        : { database_id: parentId };

    const pageData = {
        parent,
        properties: {
            title: {
                title: [{ text: { content: title } }]
            }
        }
    };

    // Add icon if provided
    if (icon) {
        pageData.icon = { emoji: icon };
    }

    // Add cover if provided
    if (cover) {
        pageData.cover = { external: { url: cover } };
    }

    // Add content blocks if provided
    if (content) {
        pageData.children = parseContentToBlocks(content);
    }

    const response = await notionClient.pages.create(pageData);

    return {
        id: response.id,
        url: response.url,
        title: title
    };
}

/**
 * Get a page by ID
 * @param {string} pageId - The page ID
 */
async function getPage(pageId) {
    if (!notionClient) throw new Error('Notion not connected. Please add your Notion API token in Settings.');

    const page = await notionClient.pages.retrieve({ page_id: pageId });
    const blocks = await notionClient.blocks.children.list({ block_id: pageId });

    return {
        id: page.id,
        title: getTitle(page),
        url: page.url,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time,
        content: blocks.results.map(block => blockToText(block)).join('\n')
    };
}

/**
 * Query a database
 * @param {string} databaseId - The database ID
 * @param {object} filter - Optional filter
 */
async function queryDatabase(databaseId, filter = {}) {
    if (!notionClient) throw new Error('Notion not connected. Please add your Notion API token in Settings.');

    const response = await notionClient.databases.query({
        database_id: databaseId,
        filter: filter.filter,
        sorts: filter.sorts,
        page_size: filter.limit || 100
    });

    return response.results.map(page => ({
        id: page.id,
        title: getTitle(page),
        url: page.url,
        properties: extractProperties(page.properties)
    }));
}

/**
 * Append content to a page
 * @param {string} pageId - The page ID
 * @param {string} content - Content to append
 */
async function appendToPage(pageId, content) {
    if (!notionClient) throw new Error('Notion not connected. Please add your Notion API token in Settings.');

    const blocks = parseContentToBlocks(content);

    await notionClient.blocks.children.append({
        block_id: pageId,
        children: blocks
    });

    return { success: true, message: 'Content appended successfully' };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract title from a Notion page/database object
 */
function getTitle(item) {
    if (item.object === 'database') {
        return item.title?.[0]?.plain_text || 'Untitled Database';
    }

    // Try to find title property
    const props = item.properties || {};
    for (const [key, value] of Object.entries(props)) {
        if (value.type === 'title' && value.title?.[0]?.plain_text) {
            return value.title[0].plain_text;
        }
    }

    return 'Untitled';
}

/**
 * Convert content string to Notion blocks
 */
function parseContentToBlocks(content) {
    if (!content) return [];

    const lines = content.split('\n');
    const blocks = [];

    for (const line of lines) {
        if (line.startsWith('# ')) {
            blocks.push({
                object: 'block',
                type: 'heading_1',
                heading_1: {
                    rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
                }
            });
        } else if (line.startsWith('## ')) {
            blocks.push({
                object: 'block',
                type: 'heading_2',
                heading_2: {
                    rich_text: [{ type: 'text', text: { content: line.slice(3) } }]
                }
            });
        } else if (line.startsWith('### ')) {
            blocks.push({
                object: 'block',
                type: 'heading_3',
                heading_3: {
                    rich_text: [{ type: 'text', text: { content: line.slice(4) } }]
                }
            });
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
            blocks.push({
                object: 'block',
                type: 'bulleted_list_item',
                bulleted_list_item: {
                    rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
                }
            });
        } else if (/^\d+\. /.test(line)) {
            blocks.push({
                object: 'block',
                type: 'numbered_list_item',
                numbered_list_item: {
                    rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\. /, '') } }]
                }
            });
        } else if (line.startsWith('> ')) {
            blocks.push({
                object: 'block',
                type: 'quote',
                quote: {
                    rich_text: [{ type: 'text', text: { content: line.slice(2) } }]
                }
            });
        } else if (line.trim()) {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ type: 'text', text: { content: line } }]
                }
            });
        }
    }

    return blocks;
}

/**
 * Convert a Notion block to plain text
 */
function blockToText(block) {
    const type = block.type;
    const content = block[type];

    if (!content) return '';

    const richText = content.rich_text || [];
    const text = richText.map(t => t.plain_text).join('');

    switch (type) {
        case 'heading_1': return `# ${text}`;
        case 'heading_2': return `## ${text}`;
        case 'heading_3': return `### ${text}`;
        case 'bulleted_list_item': return `- ${text}`;
        case 'numbered_list_item': return `1. ${text}`;
        case 'quote': return `> ${text}`;
        case 'code': return `\`\`\`\n${text}\n\`\`\``;
        case 'divider': return '---';
        default: return text;
    }
}

/**
 * Extract readable properties from a Notion page
 */
function extractProperties(properties) {
    const result = {};

    for (const [key, value] of Object.entries(properties)) {
        switch (value.type) {
            case 'title':
                result[key] = value.title?.[0]?.plain_text || '';
                break;
            case 'rich_text':
                result[key] = value.rich_text?.[0]?.plain_text || '';
                break;
            case 'number':
                result[key] = value.number;
                break;
            case 'select':
                result[key] = value.select?.name || null;
                break;
            case 'multi_select':
                result[key] = value.multi_select?.map(s => s.name) || [];
                break;
            case 'date':
                result[key] = value.date?.start || null;
                break;
            case 'checkbox':
                result[key] = value.checkbox;
                break;
            case 'url':
                result[key] = value.url;
                break;
            case 'email':
                result[key] = value.email;
                break;
            case 'phone_number':
                result[key] = value.phone_number;
                break;
            default:
                result[key] = `(${value.type})`;
        }
    }

    return result;
}

module.exports = {
    initNotion,
    getNotionClient,
    isConnected,
    disconnect,
    testConnection,
    search,
    createPage,
    getPage,
    queryDatabase,
    appendToPage
};
