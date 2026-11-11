'use strict';

const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES, ACCOUNT_STATUS } = require('../constants');

/** Story 5: a User Admin searches user accounts by name or email, optionally filtered by role and status. */
class SearchUserAccountController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    searchUserAccounts(filters = {}, actor) {
        BaseController.requireAdmin(actor);

        // Query-string values can be arrays or missing, so only accept plain strings.
        const text = value => (typeof value === 'string' ? value.trim() : '');
        const query = text(filters.query).slice(0, 100);
        const role = text(filters.role);
        const status = text(filters.status);
        if (role) Validator.oneOf(role, Object.values(ROLES), 'Role');
        if (status) Validator.oneOf(status, Object.values(ACCOUNT_STATUS), 'Status');

        return this.userEntity.searchAccounts({ query, role, status });
    }
}

module.exports = SearchUserAccountController;
