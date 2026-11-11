'use strict';

const BaseBoundary = require('./BaseBoundary');
const { ROLES } = require('../constants');

/**
 * Favourite routes (customers only):
 *   GET    /api/favourites             view my favourites           45
 *   POST   /api/favourites/:projectId  add a project                44
 *   DELETE /api/favourites/:projectId  remove a project             46
 */
class FavouriteBoundary extends BaseBoundary {
    constructor({
        createFavouriteController, viewFavouriteController, deleteFavouriteController,
        authMiddleware, roleMiddleware
    }) {
        super();
        this.createFavouriteController = createFavouriteController;
        this.viewFavouriteController = viewFavouriteController;
        this.deleteFavouriteController = deleteFavouriteController;
        this.authMiddleware = authMiddleware;
        this.roleMiddleware = roleMiddleware;
    }

    registerRoutes() {
        const customerOnly = [this.authMiddleware.requireLogin, this.roleMiddleware.requireRole(ROLES.CUSTOMER)];

        this.router.get('/favourites', ...customerOnly, this.handle(this.viewFavourites));
        this.router.post('/favourites/:projectId', ...customerOnly, this.handle(this.createFavourite));
        this.router.delete('/favourites/:projectId', ...customerOnly, this.handle(this.deleteFavourite));
    }

    viewFavourites(req, res) {
        res.json({ projects: this.viewFavouriteController.viewFavourites(req.user) });
    }

    createFavourite(req, res) {
        res.status(201).json(this.createFavouriteController.createFavourite(req.params.projectId, req.user));
    }

    deleteFavourite(req, res) {
        res.json(this.deleteFavouriteController.deleteFavourite(req.params.projectId, req.user));
    }
}

module.exports = FavouriteBoundary;
