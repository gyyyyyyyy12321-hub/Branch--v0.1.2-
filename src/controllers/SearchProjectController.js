'use strict';

const Validator = require('../utils/Validator');
const { ROLES } = require('../constants');

const SORTS = ['newest', 'views', 'favourites'];

/**
 * Stories 41 and 42: search projects by keyword and category, and browse by "newest",
 * "most viewed" or "most favourited". Public (guests included). Customers get each result
 * marked with isFavourite so the heart shows correctly.
 */
class SearchProjectController {
    constructor({ projectEntity, favouriteEntity }) {
        this.projectEntity = projectEntity;
        this.favouriteEntity = favouriteEntity;
    }

    searchProjects(filters = {}, actor = null) {
        // Query-string values can be arrays or missing, so only accept plain strings.
        const text = value => (typeof value === 'string' ? value.trim() : '');
        const query = text(filters.query).slice(0, 100);
        const sort = text(filters.sort) || 'newest';
        Validator.oneOf(sort, SORTS, 'Sort order');
        const categoryId = text(filters.categoryId) ? Validator.id(text(filters.categoryId), 'category') : null;

        const projects = this.projectEntity.search({ query, categoryId, sort });

        const saved = actor?.role === ROLES.CUSTOMER ? this.favouriteEntity.projectIdsByCustomer(actor.id) : new Set();
        return projects.map(project => ({ ...project, isFavourite: saved.has(project.id) }));
    }
}

module.exports = SearchProjectController;
