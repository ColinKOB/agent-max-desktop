/**
 * HubSpot Integration Client
 *
 * Uses @hubspot/api-client to interact with HubSpot CRM API.
 * Requires user to create a Private App and provide the access token.
 */

const hubspot = require('@hubspot/api-client');

let hubspotClient = null;
let currentToken = null;

/**
 * Initialize the HubSpot client with an access token
 * @param {string} token - HubSpot Private App Access Token
 * @returns {hubspot.Client} - Initialized HubSpot client
 */
function initHubSpot(token) {
    if (token === currentToken && hubspotClient) {
        return hubspotClient;
    }
    hubspotClient = new hubspot.Client({ accessToken: token });
    currentToken = token;
    return hubspotClient;
}

/**
 * Get the current HubSpot client (or null if not initialized)
 */
function getHubSpotClient() {
    return hubspotClient;
}

/**
 * Check if HubSpot is connected
 */
function isConnected() {
    return hubspotClient !== null && currentToken !== null;
}

/**
 * Disconnect and clear credentials
 */
function disconnect() {
    hubspotClient = null;
    currentToken = null;
}

/**
 * Test the connection by fetching account info
 */
async function testConnection(token) {
    try {
        const testClient = new hubspot.Client({ accessToken: token });
        // Try to get account info via the API
        const response = await testClient.crm.contacts.basicApi.getPage(1);
        return {
            success: true,
            message: 'Connected to HubSpot successfully'
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================================================
// HUBSPOT CRM OPERATIONS
// ============================================================================

/**
 * Get contacts
 * @param {object} options - Optional filter options
 */
async function getContacts(options = {}) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const response = await hubspotClient.crm.contacts.basicApi.getPage(
        options.limit || 100,
        options.after,
        ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'lifecyclestage']
    );

    return {
        results: response.results.map(contact => ({
            id: contact.id,
            firstName: contact.properties.firstname,
            lastName: contact.properties.lastname,
            email: contact.properties.email,
            phone: contact.properties.phone,
            company: contact.properties.company,
            jobTitle: contact.properties.jobtitle,
            lifecycleStage: contact.properties.lifecyclestage,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt
        })),
        paging: response.paging
    };
}

/**
 * Get a specific contact by ID
 * @param {string} contactId - The contact ID
 */
async function getContact(contactId) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const contact = await hubspotClient.crm.contacts.basicApi.getById(
        contactId,
        ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle', 'lifecyclestage', 'notes_last_contacted', 'notes_last_updated']
    );

    return {
        id: contact.id,
        firstName: contact.properties.firstname,
        lastName: contact.properties.lastname,
        email: contact.properties.email,
        phone: contact.properties.phone,
        company: contact.properties.company,
        jobTitle: contact.properties.jobtitle,
        lifecycleStage: contact.properties.lifecyclestage,
        lastContacted: contact.properties.notes_last_contacted,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
    };
}

/**
 * Search contacts
 * @param {string} query - Search query
 * @param {object} options - Optional search options
 */
async function searchContacts(query, options = {}) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const response = await hubspotClient.crm.contacts.searchApi.doSearch({
        query: query,
        limit: options.limit || 20,
        properties: ['firstname', 'lastname', 'email', 'phone', 'company']
    });

    return {
        total: response.total,
        results: response.results.map(contact => ({
            id: contact.id,
            firstName: contact.properties.firstname,
            lastName: contact.properties.lastname,
            email: contact.properties.email,
            phone: contact.properties.phone,
            company: contact.properties.company
        }))
    };
}

/**
 * Create a contact
 * @param {object} properties - Contact properties
 */
async function createContact(properties) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const response = await hubspotClient.crm.contacts.basicApi.create({
        properties: {
            firstname: properties.firstName,
            lastname: properties.lastName,
            email: properties.email,
            phone: properties.phone,
            company: properties.company,
            jobtitle: properties.jobTitle
        }
    });

    return {
        id: response.id,
        firstName: response.properties.firstname,
        lastName: response.properties.lastname,
        email: response.properties.email
    };
}

/**
 * Get deals
 * @param {object} options - Optional filter options
 */
async function getDeals(options = {}) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const response = await hubspotClient.crm.deals.basicApi.getPage(
        options.limit || 100,
        options.after,
        ['dealname', 'amount', 'dealstage', 'closedate', 'pipeline', 'hubspot_owner_id']
    );

    return {
        results: response.results.map(deal => ({
            id: deal.id,
            name: deal.properties.dealname,
            amount: deal.properties.amount,
            stage: deal.properties.dealstage,
            closeDate: deal.properties.closedate,
            pipeline: deal.properties.pipeline,
            ownerId: deal.properties.hubspot_owner_id,
            createdAt: deal.createdAt,
            updatedAt: deal.updatedAt
        })),
        paging: response.paging
    };
}

/**
 * Get a specific deal by ID
 * @param {string} dealId - The deal ID
 */
async function getDeal(dealId) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const deal = await hubspotClient.crm.deals.basicApi.getById(
        dealId,
        ['dealname', 'amount', 'dealstage', 'closedate', 'pipeline', 'hubspot_owner_id', 'description']
    );

    return {
        id: deal.id,
        name: deal.properties.dealname,
        amount: deal.properties.amount,
        stage: deal.properties.dealstage,
        closeDate: deal.properties.closedate,
        pipeline: deal.properties.pipeline,
        description: deal.properties.description,
        ownerId: deal.properties.hubspot_owner_id,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt
    };
}

/**
 * Search deals
 * @param {string} query - Search query
 * @param {object} options - Optional search options
 */
async function searchDeals(query, options = {}) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const response = await hubspotClient.crm.deals.searchApi.doSearch({
        query: query,
        limit: options.limit || 20,
        properties: ['dealname', 'amount', 'dealstage', 'closedate']
    });

    return {
        total: response.total,
        results: response.results.map(deal => ({
            id: deal.id,
            name: deal.properties.dealname,
            amount: deal.properties.amount,
            stage: deal.properties.dealstage,
            closeDate: deal.properties.closedate
        }))
    };
}

/**
 * Create a deal
 * @param {object} properties - Deal properties
 */
async function createDeal(properties) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const response = await hubspotClient.crm.deals.basicApi.create({
        properties: {
            dealname: properties.name,
            amount: properties.amount,
            dealstage: properties.stage || 'appointmentscheduled',
            closedate: properties.closeDate,
            pipeline: properties.pipeline || 'default'
        }
    });

    return {
        id: response.id,
        name: response.properties.dealname,
        amount: response.properties.amount,
        stage: response.properties.dealstage
    };
}

/**
 * Get companies
 * @param {object} options - Optional filter options
 */
async function getCompanies(options = {}) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const response = await hubspotClient.crm.companies.basicApi.getPage(
        options.limit || 100,
        options.after,
        ['name', 'domain', 'industry', 'phone', 'city', 'state', 'country']
    );

    return {
        results: response.results.map(company => ({
            id: company.id,
            name: company.properties.name,
            domain: company.properties.domain,
            industry: company.properties.industry,
            phone: company.properties.phone,
            city: company.properties.city,
            state: company.properties.state,
            country: company.properties.country,
            createdAt: company.createdAt,
            updatedAt: company.updatedAt
        })),
        paging: response.paging
    };
}

/**
 * Get pipelines
 */
async function getPipelines() {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    const response = await hubspotClient.crm.pipelines.pipelinesApi.getAll('deals');

    return response.results.map(pipeline => ({
        id: pipeline.id,
        label: pipeline.label,
        stages: pipeline.stages.map(stage => ({
            id: stage.id,
            label: stage.label,
            displayOrder: stage.displayOrder
        }))
    }));
}

/**
 * General search across CRM objects
 * @param {string} objectType - Type of object (contacts, deals, companies)
 * @param {string} query - Search query
 * @param {object} options - Optional search options
 */
async function search(objectType, query, options = {}) {
    if (!hubspotClient) throw new Error('HubSpot not connected. Please add your HubSpot Access Token in Settings.');

    switch (objectType.toLowerCase()) {
        case 'contacts':
            return searchContacts(query, options);
        case 'deals':
            return searchDeals(query, options);
        default:
            throw new Error(`Unknown object type: ${objectType}. Use 'contacts', 'deals', or 'companies'.`);
    }
}

module.exports = {
    initHubSpot,
    getHubSpotClient,
    isConnected,
    disconnect,
    testConnection,
    getContacts,
    getContact,
    searchContacts,
    createContact,
    getDeals,
    getDeal,
    searchDeals,
    createDeal,
    getCompanies,
    getPipelines,
    search
};
