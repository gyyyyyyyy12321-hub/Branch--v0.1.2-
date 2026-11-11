'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/** Story 30: an interior designer removes one of their own projects (and its image file). */
class DeleteProjectController {
    constructor({ projectEntity, imageStorage }) {
        this.projectEntity = projectEntity;
        this.imageStorage = imageStorage;
    }

    deleteProject(projectId, actor) {
        BaseController.requireRole(actor, ROLES.DESIGNER, 'Only interior designers can remove projects.');
        const id = Validator.id(projectId, 'project id');
        const project = this.projectEntity.findById(id);
        if (!project) throw new AppError(404, 'Project not found.');
        if (project.designer_id !== actor.id) throw new AppError(403, 'You can only remove your own projects.');

        this.projectEntity.deleteById(id); // favourites go with it; enquiries keep their text but lose the link
        this.imageStorage.delete(project.image_path);
        return { message: 'Project removed.' };
    }
}

module.exports = DeleteProjectController;
