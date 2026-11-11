'use strict';

const BaseBoundary = require('./BaseBoundary');
const { ROLES } = require('../constants');

/**
 * Platform statistics and reports (Platform Management only):
 *   GET /api/statistics/visits             site visits               55
 *   GET /api/statistics/active-customers   active customer count     56
 *   GET /api/statistics/active-designers   active designer count     57
 *   GET /api/reports?period=&date=         daily / weekly / monthly   58
 */
class StatisticsBoundary extends BaseBoundary {
    constructor({
        viewSiteVisitController, viewActiveCustomerController, viewActiveDesignerController,
        createReportController, authMiddleware, roleMiddleware
    }) {
        super();
        this.viewSiteVisitController = viewSiteVisitController;
        this.viewActiveCustomerController = viewActiveCustomerController;
        this.viewActiveDesignerController = viewActiveDesignerController;
        this.createReportController = createReportController;
        this.authMiddleware = authMiddleware;
        this.roleMiddleware = roleMiddleware;
    }

    registerRoutes() {
        const platformOnly = [this.authMiddleware.requireLogin, this.roleMiddleware.requireRole(ROLES.PLATFORM_MANAGEMENT)];

        this.router.get('/statistics/visits', ...platformOnly, this.handle(this.viewVisits));
        this.router.get('/statistics/active-customers', ...platformOnly, this.handle(this.viewActiveCustomers));
        this.router.get('/statistics/active-designers', ...platformOnly, this.handle(this.viewActiveDesigners));
        this.router.get('/reports', ...platformOnly, this.handle(this.createReport));
    }

    viewVisits(req, res) {
        res.json({ visits: this.viewSiteVisitController.viewSiteVisits(req.user) });
    }

    viewActiveCustomers(req, res) {
        res.json(this.viewActiveCustomerController.viewActiveCustomers(req.user));
    }

    viewActiveDesigners(req, res) {
        res.json(this.viewActiveDesignerController.viewActiveDesigners(req.user));
    }

    createReport(req, res) {
        res.json({ report: this.createReportController.createReport(req.query ?? {}, req.user) });
    }
}

module.exports = StatisticsBoundary;
