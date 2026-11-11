'use strict';

// These strings must match the CHECK constraints in database/schema.sql.
const ROLES = Object.freeze({
    CUSTOMER: 'Customer',
    DESIGNER: 'Interior Designer',
    USER_ADMIN: 'User Admin',
    PLATFORM_MANAGEMENT: 'Platform Management'
});

const ACCOUNT_STATUS = Object.freeze({
    ACTIVE: 'Active',
    PENDING: 'Pending',
    SUSPENDED: 'Suspended',
    DEACTIVATED: 'Deactivated'
});

const PROJECT_STATUS = Object.freeze({ CURRENT: 'Current', PAST: 'Past' });

const CREDENTIAL_STATUS = Object.freeze({
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected'
});

module.exports = { ROLES, ACCOUNT_STATUS, PROJECT_STATUS, CREDENTIAL_STATUS };
