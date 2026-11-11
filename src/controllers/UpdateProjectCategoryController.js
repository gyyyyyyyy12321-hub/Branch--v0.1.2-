'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/** Story 50: Platform Management renames a category. Its projects follow automatically (they link by id). */
class UpdateProjectCategoryController {
    constructor({ categoryEntity }) {
        this.categoryEntity = categoryEntity;
    }

    updateProjectCategory(categoryId, input = {}, actor) {
        BaseController.requireRole(actor, ROLES.PLATFORM_MANAGEMENT, 'Only Platform Management can manage categories.');
        const id = Validator.id(categoryId, 'category id');
        const name = Validator.requiredText(input.name, 'Category name', 50);
        if (!this.categoryEntity.findById(id)) throw new AppError(404, 'Category not found.');

        const sameName = this.categoryEntity.findByName(name);
        if (sameName && sameName.id !== id) {
            throw new AppError(409, 'A category with this name already exists.');
        }
        this.categoryEntity.rename(id, name);
        return { id, name, projectCount: this.categoryEntity.countProjects(id) };
    }
}

module.exports = UpdateProjectCategoryController;
