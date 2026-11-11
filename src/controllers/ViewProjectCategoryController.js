'use strict';

/**
 * Story 49: view all interior design project categories (with how many projects each has).
 * Public, because customers need the list for the category filter and designers for the project form.
 */
class ViewProjectCategoryController {
    constructor({ categoryEntity }) {
        this.categoryEntity = categoryEntity;
    }

    viewProjectCategories() {
        return this.categoryEntity.findAllWithCounts();
    }
}

module.exports = ViewProjectCategoryController;
