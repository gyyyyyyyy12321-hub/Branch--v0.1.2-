'use strict';

const AppError = require('../utils/AppError');
const PasswordHasher = require('../utils/PasswordHasher');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');

/**
 * Stories 6, 20, 35: update a user account.
 * Email can be changed by the owner or a User Admin. A password can only be changed by its owner, who must
 * give the current password (an admin who needs to help a user uses ResetUserPasswordController).
 * Role and status have their own controllers.
 */
class UpdateUserAccountController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    updateUserAccount(userId, input = {}, actor) {
        const id = Validator.id(userId, 'user id');
        BaseController.requireSelfOrAdmin(id, actor);
        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');

        const changingEmail = input.email !== undefined;
        const changingPassword = input.newPassword !== undefined;
        if (!changingEmail && !changingPassword) throw new AppError(400, 'Nothing to update.');

        // Validate everything first so a bad request changes nothing.
        let email = null;
        if (changingEmail) {
            email = Validator.email(input.email);
            if (email.toLowerCase() !== user.email.toLowerCase() && this.userEntity.emailTaken(email, id)) {
                throw new AppError(409, 'An account with this email already exists.');
            }
        }

        let newHash = null;
        if (changingPassword) {
            if (actor.id !== id) {
                throw new AppError(403, "Use reset password to change another user's password.");
            }
            if (!PasswordHasher.verify(String(input.currentPassword ?? ''), user.password_hash)) {
                throw new AppError(400, 'Current password is incorrect.');
            }
            newHash = PasswordHasher.hash(Validator.password(input.newPassword));
        }

        if (changingEmail) this.userEntity.updateEmail(id, email);
        if (changingPassword) this.userEntity.updatePasswordHash(id, newHash);
        return this.userEntity.findAccountById(id);
    }
}

module.exports = UpdateUserAccountController;
