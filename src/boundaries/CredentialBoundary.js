'use strict';

const BaseBoundary = require('./BaseBoundary');
const { ROLES } = require('../constants');

/**
 * Company credential routes (interior designers only). A Pending designer is allowed in,
 * because submitting credentials is how they get approved.
 *   GET  /api/credentials/me  status of the latest submission (credential is null if none)
 *   POST /api/credentials     submit company name and registration number
 */
class CredentialBoundary extends BaseBoundary {
    constructor({ submitCredentialsController, viewCredentialsController, authMiddleware, roleMiddleware }) {
        super();
        this.submitCredentialsController = submitCredentialsController;
        this.viewCredentialsController = viewCredentialsController;
        this.authMiddleware = authMiddleware;
        this.roleMiddleware = roleMiddleware;
    }

    registerRoutes() {
        const designerOnly = [
            this.authMiddleware.requireLoginAllowPending,
            this.roleMiddleware.requireRole(ROLES.DESIGNER)
        ];
        this.router.get('/credentials/me', ...designerOnly, this.handle(this.viewCredentials));
        this.router.post('/credentials', ...designerOnly, this.handle(this.submitCredentials));
    }

    viewCredentials(req, res) {
        res.json({ credential: this.viewCredentialsController.viewCredentials(req.user) });
    }

    submitCredentials(req, res) {
        res.status(201).json({ credential: this.submitCredentialsController.submitCredentials(req.body ?? {}, req.user) });
    }
}

module.exports = CredentialBoundary;
