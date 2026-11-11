'use strict';

const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/** Story 45: a customer views their favourites list (most recently saved first). */
class ViewFavouriteController {
    constructor({ projectEntity }) {
        this.projectEntity = projectEntity;
    }

    viewFavourites(actor) {
        BaseController.requireRole(actor, ROLES.CUSTOMER, 'Only customers have a favourites list.');
        return this.projectEntity
            .findFavouritedByCustomer(actor.id)
            .map(project => ({ ...project, isFavourite: true }));
    }
}

module.exports = ViewFavouriteController;
