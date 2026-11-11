'use strict';

const BaseBoundary = require('./BaseBoundary');
const { ROLES } = require('../constants');

/**
 * Profile routes (public-facing details):
 *   GET   /api/profiles          search profiles   (admin)  ?query=
 *   GET   /api/profiles/:userId  view a profile    (self or admin)
 *   PATCH /api/profiles/:userId  update a profile  (self or admin)
 */
class ProfileBoundary extends BaseBoundary {
    constructor({
        searchUserProfileController, viewUserProfileController, updateUserProfileController,
        authMiddleware, roleMiddleware
    }) {
        super();
        this.searchUserProfileController = searchUserProfileController;
        this.viewUserProfileController = viewUserProfileController;
        this.updateUserProfileController = updateUserProfileController;
        this.authMiddleware = authMiddleware;
        this.roleMiddleware = roleMiddleware;
    }

    registerRoutes() {
        const loggedIn = this.authMiddleware.requireLogin;
        const adminOnly = [loggedIn, this.roleMiddleware.requireRole(ROLES.USER_ADMIN)];

        this.router.get('/profiles', ...adminOnly, this.handle(this.searchProfiles));
        this.router.get('/profiles/:userId', loggedIn, this.handle(this.viewProfile));
        this.router.patch('/profiles/:userId', loggedIn, this.handle(this.updateProfile));
    }

    searchProfiles(req, res) {
        res.json({ profiles: this.searchUserProfileController.searchUserProfiles(req.query ?? {}, req.user) });
    }

    viewProfile(req, res) {
        res.json({ profile: this.viewUserProfileController.viewUserProfile(req.params.userId, req.user) });
    }

    updateProfile(req, res) {
        res.json({ profile: this.updateUserProfileController.updateUserProfile(req.params.userId, req.body ?? {}, req.user) });
    }
}

module.exports = ProfileBoundary;
