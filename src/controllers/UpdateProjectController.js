'use strict';

const AppError = require('../utils/AppError');
const ProjectInput = require('../utils/ProjectInput');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/**
 * Story 29: an interior designer edits one of their own projects.
 * Only the fields present change. A new image replaces the old one (the old file is deleted);
 * input.removeImage = true / "true" clears the image. If the update fails, the newly saved file is deleted.
 */
class UpdateProjectController {
    constructor({ projectEntity, categoryEntity, imageStorage }) {
        this.projectEntity = projectEntity;
        this.categoryEntity = categoryEntity;
        this.imageStorage = imageStorage;
    }

    updateProject(projectId, input = {}, actor, newImagePath = null) {
        let replacedImage = null;
        let updated;
        try {
            BaseController.requireRole(actor, ROLES.DESIGNER, 'Only interior designers can edit projects.');
            const id = Validator.id(projectId, 'project id');
            const project = this.projectEntity.findById(id);
            if (!project) throw new AppError(404, 'Project not found.');
            if (project.designer_id !== actor.id) throw new AppError(403, 'You can only change your own projects.');

            const fields = ProjectInput.parse(input, this.categoryEntity, { partial: true });
            const removeImage = input.removeImage === true || input.removeImage === 'true';
            if (newImagePath) {
                fields.imagePath = newImagePath;
            } else if (removeImage) {
                fields.imagePath = null;
            }
            if (!Object.keys(fields).length) throw new AppError(400, 'Nothing to update.');

            this.projectEntity.update(id, fields);
            if ('imagePath' in fields) replacedImage = project.image_path;
            updated = this.projectEntity.findDetailById(id);
        } catch (err) {
            this.imageStorage.delete(newImagePath);
            throw err;
        }
        // Only after the database change succeeded is it safe to drop the old file.
        this.imageStorage.delete(replacedImage);
        return updated;
    }
}

module.exports = UpdateProjectController;
