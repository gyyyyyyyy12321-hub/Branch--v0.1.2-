'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ACCOUNT_STATUS } = require('../constants');

/** Story 7: a User Admin suspends an Active account (for example a compromised one). */
class SuspendUserAccountController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    suspendUserAccount(userId, actor) {
        BaseController.requireAdmin(actor);
        const id = Validator.id(userId, 'user id');
        if (actor.id === id) throw new AppError(400, 'You cannot suspend your own account.');

        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');
        if (user.status !== ACCOUNT_STATUS.ACTIVE) {
            throw new AppError(400, 'Only active accounts can be suspended.');
        }

        this.userEntity.updateStatus(id, ACCOUNT_STATUS.SUSPENDED);
        return this.userEntity.findAccountById(id);
    }
}

module.exports = SuspendUserAccountController;
