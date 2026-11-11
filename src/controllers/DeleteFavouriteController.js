'use strict';

const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/** Story 46: a customer removes a project from their favourites. Removing something not saved is harmless. */
class DeleteFavouriteController {
    constructor({ favouriteEntity }) {
        this.favouriteEntity = favouriteEntity;
    }

    deleteFavourite(projectId, actor) {
        BaseController.requireRole(actor, ROLES.CUSTOMER, 'Only customers have a favourites list.');
        const id = Validator.id(projectId, 'project id');
        this.favouriteEntity.remove(actor.id, id);
        return { isFavourite: false, favouriteCount: this.favouriteEntity.countForProject(id) };
    }
}

module.exports = DeleteFavouriteController;
