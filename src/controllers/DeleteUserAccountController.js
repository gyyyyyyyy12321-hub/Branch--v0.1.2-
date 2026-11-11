'use strict';

const AppError = require('../utils/AppError');
const PasswordHasher = require('../utils/PasswordHasher');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');

/**
 * Stories 8, 21, 36: delete a user account (permanent).
 * A User Admin can delete any other account. Customers and designers can delete their own, after confirming
 * their password. The database cascades to profile, credentials, projects, favourites and enquiries.
 */
class DeleteUserAccountController {
    constructor({ userEntity, projectEntity, imageStorage }) {
        this.userEntity = userEntity;
        this.projectEntity = projectEntity;
        this.imageStorage = imageStorage;
    }

    deleteUserAccount(userId, actor, input = {}) {
        const id = Validator.id(userId, 'user id');
        BaseController.requireSelfOrAdmin(id, actor);
        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');

        if (actor.id === id) {
            if (BaseController.isAdmin(actor)) {
                throw new AppError(400, 'An admin cannot delete their own account.');
            }
            BaseController.requireSelfServiceRole(user);
            if (!PasswordHasher.verify(String(input.password ?? ''), user.password_hash)) {
                throw new AppError(400, 'Password is incorrect.');
            }
        }

        // Read image paths first; the rows are gone once the user is deleted.
        const imagePaths = this.projectEntity.findImagePathsByDesigner(id);
        this.userEntity.deleteById(id);
        for (const imagePath of imagePaths) this.imageStorage.delete(imagePath);

        return { message: 'Account deleted.' };
    }
}

module.exports = DeleteUserAccountController;
