'use strict';

const BaseController = require('./BaseController');
const { ROLES, ACCOUNT_STATUS } = require('../constants');

/** Story 57: Platform Management views the number of active registered interior design companies (status Active). */
class ViewActiveDesignerController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    viewActiveDesigners(actor) {
        BaseController.requireRole(actor, ROLES.PLATFORM_MANAGEMENT, 'Only Platform Management can view this.');
        return {
            active: this.userEntity.countByRoleAndStatus(ROLES.DESIGNER, ACCOUNT_STATUS.ACTIVE),
            registered: this.userEntity.countByRole(ROLES.DESIGNER)
        };
    }
}

module.exports = ViewActiveDesignerController;
