'use strict';

const AppError = require('../utils/AppError');
const PasswordHasher = require('../utils/PasswordHasher');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ACCOUNT_STATUS } = require('../constants');

/**
 * Stories 10, 23, 38: reactivate a user account.
 *   reactivateUserAccount     : a User Admin reactivates a Deactivated or Suspended account (lifts a suspension too).
 *   reactivateOwnUserAccount  : a user who deactivated their own account proves who they are with email and
 *                               password. Suspended accounts cannot do this; only an admin can lift a suspension.
 */
class ReactivateUserAccountController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    reactivateUserAccount(userId, actor) {
        BaseController.requireAdmin(actor);
        const id = Validator.id(userId, 'user id');
        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');
        if (![ACCOUNT_STATUS.DEACTIVATED, ACCOUNT_STATUS.SUSPENDED].includes(user.status)) {
            throw new AppError(400, 'Only suspended or deactivated accounts can be reactivated.');
        }
        this.userEntity.updateStatus(id, ACCOUNT_STATUS.ACTIVE);
        return this.userEntity.findAccountById(id);
    }

    reactivateOwnUserAccount({ email, password } = {}) {
        const user = this.userEntity.findByEmail(email);
        if (!PasswordHasher.verifyOptional(password, user?.password_hash) || !user) {
            throw new AppError(401, 'Invalid email or password.');
        }
        if (user.status === ACCOUNT_STATUS.SUSPENDED) {
            throw new AppError(403, 'A suspended account can only be reactivated by an administrator.', 'ACCOUNT_SUSPENDED');
        }
        if (user.status !== ACCOUNT_STATUS.DEACTIVATED) {
            throw new AppError(400, 'Only deactivated accounts can be reactivated.');
        }
        this.userEntity.updateStatus(user.id, ACCOUNT_STATUS.ACTIVE);
        return this.userEntity.findAccountById(user.id);
    }
}

module.exports = ReactivateUserAccountController;
