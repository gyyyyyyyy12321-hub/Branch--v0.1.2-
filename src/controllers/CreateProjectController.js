'use strict';

const ProjectInput = require('../utils/ProjectInput');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/**
 * Story 28: an interior designer adds a project to their portfolio.
 * `imagePath` is the public path of an image the upload middleware already saved (or null).
 * If anything fails here, that saved file is deleted so no orphan is left in uploads/.
 */
class CreateProjectController {
    constructor({ projectEntity, categoryEntity, imageStorage }) {
        this.projectEntity = projectEntity;
        this.categoryEntity = categoryEntity;
        this.imageStorage = imageStorage;
    }

    createProject(input = {}, actor, imagePath = null) {
        try {
            BaseController.requireRole(actor, ROLES.DESIGNER, 'Only interior designers can add projects.');
            const fields = ProjectInput.parse(input, this.categoryEntity);
            const id = this.projectEntity.create({ designerId: actor.id, ...fields, imagePath });
            return this.projectEntity.findDetailById(id);
        } catch (err) {
            this.imageStorage.delete(imagePath);
            throw err;
        }
    }
}

module.exports = CreateProjectController;
