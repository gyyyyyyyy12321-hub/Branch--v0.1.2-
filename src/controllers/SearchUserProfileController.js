'use strict';

const BaseController = require('./BaseController');

/** Story 11: a User Admin searches user profiles (name, description, location, services). */
class SearchUserProfileController {
    constructor({ profileEntity }) {
        this.profileEntity = profileEntity;
    }

    searchUserProfiles(filters = {}, actor) {
        BaseController.requireAdmin(actor);
        const query = typeof filters.query === 'string' ? filters.query.trim().slice(0, 100) : '';
        return this.profileEntity.search(query);
    }
}

module.exports = SearchUserProfileController;
