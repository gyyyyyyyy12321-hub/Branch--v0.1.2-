'use strict';

const BaseController = require('./BaseController');
const { ROLES, ACCOUNT_STATUS } = require('../constants');

/** Story 56: Platform Management views the number of active registered customers (accounts with status Active). */
class ViewActiveCustomerController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    viewActiveCustomers(actor) {
        BaseController.requireRole(actor, ROLES.PLATFORM_MANAGEMENT, 'Only Platform Management can view this.');
        return {
            active: this.userEntity.countByRoleAndStatus(ROLES.CUSTOMER, ACCOUNT_STATUS.ACTIVE),
            registered: this.userEntity.countByRole(ROLES.CUSTOMER)
        };
    }
}

module.exports = ViewActiveCustomerController;
