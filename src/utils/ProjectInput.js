'use strict';

const AppError = require('./AppError');
const Validator = require('./Validator');
const { PROJECT_STATUS } = require('../constants');

/** Checks and cleans the project fields shared by CreateProjectController and UpdateProjectController. */
class ProjectInput {
    /**
     * Returns { title, description, categoryId, status, year }.
     * With partial = true (updates) only the fields present in `input` are checked and returned.
     */
    static parse(input, categoryEntity, { partial = false } = {}) {
        const out = {};
        const present = key => input[key] !== undefined;

        if (!partial || present('title')) {
            out.title = Validator.requiredText(input.title, 'Title', 120);
        }
        if (!partial || present('description')) {
            out.description = Validator.requiredText(input.description, 'Description', 2000);
        }
        if (!partial || present('categoryId')) {
            const id = Number(input.categoryId);
            if (!Number.isInteger(id) || id <= 0 || !categoryEntity.findById(id)) {
                throw new AppError(400, 'Choose a valid category.');
            }
            out.categoryId = id;
        }
        if (!partial || present('status')) {
            out.status = Validator.oneOf(input.status ?? PROJECT_STATUS.CURRENT, Object.values(PROJECT_STATUS), 'Project status');
        }
        if (present('year')) {
            const raw = String(input.year).trim();
            if (raw === '') {
                out.year = null;
            } else {
                const year = Number(raw);
                if (!Number.isInteger(year) || year < 1900 || year > 2100) {
                    throw new AppError(400, 'Year must be between 1900 and 2100.');
                }
                out.year = year;
            }
        } else if (!partial) {
            out.year = null;
        }
        return out;
    }
}

module.exports = ProjectInput;
