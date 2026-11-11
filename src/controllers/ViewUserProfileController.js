'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');

/** Stories 12, 24: view a user profile (the publicly displayed details). Own profile, or any for a User Admin. */
class ViewUserProfileController {
    constructor({ profileEntity }) {
        this.profileEntity = profileEntity;
    }

    viewUserProfile(userId, actor) {
        const id = Validator.id(userId, 'user id');
        BaseController.requireSelfOrAdmin(id, actor);
        const profile = this.profileEntity.findByUserId(id);
        if (!profile) throw new AppError(404, 'User profile not found.');
        return profile;
    }
}

module.exports = ViewUserProfileController;
