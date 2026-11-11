'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES, ACCOUNT_STATUS } = require('../constants');

/** Story 44: a customer adds a project to their favourites. Saving twice is harmless. */
class CreateFavouriteController {
    constructor({ projectEntity, favouriteEntity }) {
        this.projectEntity = projectEntity;
        this.favouriteEntity = favouriteEntity;
    }

    createFavourite(projectId, actor) {
        BaseController.requireRole(actor, ROLES.CUSTOMER, 'Only customers can save favourites.');
        const id = Validator.id(projectId, 'project id');
        const project = this.projectEntity.findDetailById(id);
        if (!project || project.designerStatus !== ACCOUNT_STATUS.ACTIVE) {
            throw new AppError(404, 'Project not found.');
        }

        this.favouriteEntity.add(actor.id, id);
        return { isFavourite: true, favouriteCount: this.favouriteEntity.countForProject(id) };
    }
}

module.exports = CreateFavouriteController;
