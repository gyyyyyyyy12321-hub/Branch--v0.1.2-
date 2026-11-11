'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');

/**
 * Stories 13, 25: update a user profile. Own profile, or any for a User Admin.
 * Only the fields present in the request change; an empty optional field clears it.
 */
class UpdateUserProfileController {
    constructor({ profileEntity }) {
        this.profileEntity = profileEntity;
    }

    updateUserProfile(userId, input = {}, actor) {
        const id = Validator.id(userId, 'user id');
        BaseController.requireSelfOrAdmin(id, actor);
        if (!this.profileEntity.findByUserId(id)) throw new AppError(404, 'User profile not found.');

        const changes = {};
        if (input.name !== undefined) changes.name = Validator.requiredText(input.name, 'Name', 100);
        if (input.phone !== undefined) changes.phone = Validator.optionalText(input.phone, 'Phone number', 30);
        if (input.description !== undefined) changes.description = Validator.optionalText(input.description, 'Description', 1000);
        if (input.location !== undefined) changes.location = Validator.optionalText(input.location, 'Location', 100);
        if (input.services !== undefined) changes.services = Validator.optionalText(input.services, 'Services', 300);
        if (!Object.keys(changes).length) throw new AppError(400, 'Nothing to update.');

        this.profileEntity.update(id, changes);
        return this.profileEntity.findByUserId(id);
    }
}

module.exports = UpdateUserProfileController;
