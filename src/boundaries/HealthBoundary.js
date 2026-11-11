'use strict';

const BaseBoundary = require('./BaseBoundary');

/** GET /api/health : confirms the server and database are working. */
class HealthBoundary extends BaseBoundary {
    constructor({ viewHealthController }) {
        super();
        this.viewHealthController = viewHealthController;
    }

    registerRoutes() {
        this.router.get('/health', this.handle(this.getHealth));
    }

    getHealth(req, res) {
        res.json(this.viewHealthController.viewHealth());
    }
}

module.exports = HealthBoundary;
