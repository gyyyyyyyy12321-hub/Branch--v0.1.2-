'use strict';

const BaseBoundary = require('./BaseBoundary');
const UploadMiddleware = require('../middleware/UploadMiddleware');
const { ROLES } = require('../constants');

/**
 * Project routes:
 *   GET    /api/projects?query=&categoryId=&sort=  search / browse   (public)             41, 42
 *   GET    /api/projects/:id                       view a project    (public, counts a view) 43
 *   POST   /api/projects        add a project (multipart: fields + optional "image") (designer)  28
 *   PATCH  /api/projects/:id    edit a project (multipart, optional "image" / removeImage) (owner) 29
 *   DELETE /api/projects/:id    remove a project                                   (owner)    30
 *   GET    /api/portfolio       own projects with view and shortlist counts        (designer) 31, 32
 * Designer routes run login and role checks BEFORE the upload middleware, so nobody else can upload files.
 */
class ProjectBoundary extends BaseBoundary {
    constructor({
        searchProjectController, viewProjectController, createProjectController, updateProjectController,
        deleteProjectController, viewPortfolioController, authMiddleware, roleMiddleware, uploadMiddleware
    }) {
        super();
        this.searchProjectController = searchProjectController;
        this.viewProjectController = viewProjectController;
        this.createProjectController = createProjectController;
        this.updateProjectController = updateProjectController;
        this.deleteProjectController = deleteProjectController;
        this.viewPortfolioController = viewPortfolioController;
        this.authMiddleware = authMiddleware;
        this.roleMiddleware = roleMiddleware;
        this.uploadMiddleware = uploadMiddleware;
    }

    registerRoutes() {
        const designerOnly = [this.authMiddleware.requireLogin, this.roleMiddleware.requireRole(ROLES.DESIGNER)];
        const image = this.uploadMiddleware.single('image');

        this.router.get('/projects', this.handle(this.searchProjects));
        this.router.get('/projects/:id', this.handle(this.viewProject));
        this.router.post('/projects', ...designerOnly, image, this.handle(this.createProject));
        this.router.patch('/projects/:id', ...designerOnly, image, this.handle(this.updateProject));
        this.router.delete('/projects/:id', ...designerOnly, this.handle(this.deleteProject));
        this.router.get('/portfolio', ...designerOnly, this.handle(this.viewPortfolio));
    }

    searchProjects(req, res) {
        res.json({ projects: this.searchProjectController.searchProjects(req.query ?? {}, req.user) });
    }

    viewProject(req, res) {
        res.json({ project: this.viewProjectController.viewProject(req.params.id, req.user) });
    }

    createProject(req, res) {
        const project = this.createProjectController.createProject(req.body ?? {}, req.user, UploadMiddleware.publicPathOf(req.file));
        res.status(201).json({ project });
    }

    updateProject(req, res) {
        const project = this.updateProjectController.updateProject(
            req.params.id, req.body ?? {}, req.user, UploadMiddleware.publicPathOf(req.file)
        );
        res.json({ project });
    }

    deleteProject(req, res) {
        res.json(this.deleteProjectController.deleteProject(req.params.id, req.user));
    }

    viewPortfolio(req, res) {
        res.json(this.viewPortfolioController.viewPortfolio(req.user));
    }
}

module.exports = ProjectBoundary;
