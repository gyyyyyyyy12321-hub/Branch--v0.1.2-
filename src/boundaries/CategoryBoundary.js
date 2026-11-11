'use strict';

const BaseBoundary = require('./BaseBoundary');
const { ROLES } = require('../constants');

/**
 * Category routes:
 *   GET    /api/categories?query=  list or search categories (public)   stories 49, 52
 *   POST   /api/categories         add a category          (Platform Management)  48
 *   PATCH  /api/categories/:id     rename a category       (Platform Management)  50
 *   DELETE /api/categories/:id     delete a category       (Platform Management)  51
 */
class CategoryBoundary extends BaseBoundary {
    constructor({
        createProjectCategoryController, viewProjectCategoryController, searchProjectCategoryController,
        updateProjectCategoryController, deleteProjectCategoryController, authMiddleware, roleMiddleware
    }) {
        super();
        this.createProjectCategoryController = createProjectCategoryController;
        this.viewProjectCategoryController = viewProjectCategoryController;
        this.searchProjectCategoryController = searchProjectCategoryController;
        this.updateProjectCategoryController = updateProjectCategoryController;
        this.deleteProjectCategoryController = deleteProjectCategoryController;
        this.authMiddleware = authMiddleware;
        this.roleMiddleware = roleMiddleware;
    }

    registerRoutes() {
        const platformOnly = [this.authMiddleware.requireLogin, this.roleMiddleware.requireRole(ROLES.PLATFORM_MANAGEMENT)];

        this.router.get('/categories', this.handle(this.listCategories));
        this.router.post('/categories', ...platformOnly, this.handle(this.createCategory));
        this.router.patch('/categories/:id', ...platformOnly, this.handle(this.updateCategory));
        this.router.delete('/categories/:id', ...platformOnly, this.handle(this.deleteCategory));
    }

    listCategories(req, res) {
        const query = req.query ?? {};
        const categories = query.query
            ? this.searchProjectCategoryController.searchProjectCategories(query)
            : this.viewProjectCategoryController.viewProjectCategories();
        res.json({ categories });
    }

    createCategory(req, res) {
        res.status(201).json({ category: this.createProjectCategoryController.createProjectCategory(req.body ?? {}, req.user) });
    }

    updateCategory(req, res) {
        res.json({ category: this.updateProjectCategoryController.updateProjectCategory(req.params.id, req.body ?? {}, req.user) });
    }

    deleteCategory(req, res) {
        res.json(this.deleteProjectCategoryController.deleteProjectCategory(req.params.id, req.user));
    }
}

module.exports = CategoryBoundary;
