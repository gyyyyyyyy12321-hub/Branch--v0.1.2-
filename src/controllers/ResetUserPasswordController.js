'use strict';

const AppError = require('../utils/AppError');
const PasswordHasher = require('../utils/PasswordHasher');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');

/**
 * Story 16: a User Admin resets a user's password so the user can regain access.
 * A temporary password is generated and returned once, for the admin to pass to the user securely.
 */
class ResetUserPasswordController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    resetUserPassword(userId, actor) {
        BaseController.requireAdmin(actor);
        const id = Validator.id(userId, 'user id');
        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');

        const temporaryPassword = PasswordHasher.generateTemporary();
        this.userEntity.updatePasswordHash(id, PasswordHasher.hash(temporaryPassword));
        return { temporaryPassword };
    }
}

module.exports = ResetUserPasswordController;
