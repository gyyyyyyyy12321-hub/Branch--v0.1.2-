'use strict';

/** Story 52: search interior design project categories by name. Public, like viewing the list. */
class SearchProjectCategoryController {
    constructor({ categoryEntity }) {
        this.categoryEntity = categoryEntity;
    }

    searchProjectCategories(filters = {}) {
        // Query-string values can be arrays or missing, so only accept plain strings.
        const query = typeof filters.query === 'string' ? filters.query.trim().slice(0, 50) : '';
        return this.categoryEntity.findAllWithCounts(query);
    }
}

module.exports = SearchProjectCategoryController;
