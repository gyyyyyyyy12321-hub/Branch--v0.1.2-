'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const { ROLES, ACCOUNT_STATUS } = require('../constants');

/**
 * Story 43: view the information of a project. Public (guests included).
 * Every opening counts as one view (stories 31 and 42), except the owner looking at their own project.
 * Projects of designers who are not Active are hidden from everyone but their owner.
 */
class ViewProjectController {
    constructor({ projectEntity, favouriteEntity }) {
        this.projectEntity = projectEntity;
        this.favouriteEntity = favouriteEntity;
    }

    viewProject(projectId, actor = null) {
        const id = Validator.id(projectId, 'project id');
        const project = this.projectEntity.findDetailById(id);
        const isOwner = actor !== null && actor.id === project?.designerId;
        if (!project || (project.designerStatus !== ACCOUNT_STATUS.ACTIVE && !isOwner)) {
            throw new AppError(404, 'Project not found.');
        }

        if (!isOwner) {
            this.projectEntity.incrementViewCount(id);
            project.viewCount += 1;
        }
        project.isFavourite = actor?.role === ROLES.CUSTOMER && this.favouriteEntity.isFavourite(actor.id, id);
        delete project.designerStatus;
        return project;
    }
}

module.exports = ViewProjectController;
