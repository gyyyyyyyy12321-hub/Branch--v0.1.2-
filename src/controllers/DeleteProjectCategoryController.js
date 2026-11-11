'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/** Story 51: Platform Management deletes a category. Refused while projects still use it. */
class DeleteProjectCategoryController {
    constructor({ categoryEntity }) {
        this.categoryEntity = categoryEntity;
    }

    deleteProjectCategory(categoryId, actor) {
        BaseController.requireRole(actor, ROLES.PLATFORM_MANAGEMENT, 'Only Platform Management can manage categories.');
        const id = Validator.id(categoryId, 'category id');
        if (!this.categoryEntity.findById(id)) throw new AppError(404, 'Category not found.');

        const inUse = this.categoryEntity.countProjects(id);
        if (inUse > 0) {
            throw new AppError(409, `This category is used by ${inUse} project${inUse === 1 ? '' : 's'}. Move them to another category first.`);
        }
        this.categoryEntity.deleteById(id);
        return { message: 'Category deleted.' };
    }
}

module.exports = DeleteProjectCategoryController;
