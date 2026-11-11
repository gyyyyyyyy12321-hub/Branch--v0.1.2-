'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/** Story 48: Platform Management adds a new interior design project category. */
class CreateProjectCategoryController {
    constructor({ categoryEntity }) {
        this.categoryEntity = categoryEntity;
    }

    createProjectCategory(input = {}, actor) {
        BaseController.requireRole(actor, ROLES.PLATFORM_MANAGEMENT, 'Only Platform Management can manage categories.');
        const name = Validator.requiredText(input.name, 'Category name', 50);
        if (this.categoryEntity.findByName(name)) {
            throw new AppError(409, 'A category with this name already exists.');
        }
        const id = this.categoryEntity.create(name);
        return { id, name, projectCount: 0 };
    }
}

module.exports = CreateProjectCategoryController;
