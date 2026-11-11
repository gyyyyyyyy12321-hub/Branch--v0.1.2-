'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ACCOUNT_STATUS } = require('../constants');

/**
 * Stories 9, 22, 37: deactivate a user account (reversible).
 * A User Admin can deactivate any other Active account. Customers and designers can deactivate their own.
 */
class DeactivateUserAccountController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    deactivateUserAccount(userId, actor) {
        const id = Validator.id(userId, 'user id');
        BaseController.requireSelfOrAdmin(id, actor);
        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');

        if (actor.id === id) {
            if (BaseController.isAdmin(actor)) {
                throw new AppError(400, 'An admin cannot deactivate their own account.');
            }
            BaseController.requireSelfServiceRole(user);
        }
        if (user.status !== ACCOUNT_STATUS.ACTIVE) {
            throw new AppError(400, 'Only active accounts can be deactivated.');
        }

        this.userEntity.updateStatus(id, ACCOUNT_STATUS.DEACTIVATED);
        return this.userEntity.findAccountById(id);
    }
}

module.exports = DeactivateUserAccountController;
