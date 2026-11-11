'use strict';

const BaseBoundary = require('./BaseBoundary');
const { ROLES } = require('../constants');

/**
 * Enquiry routes:
 *   POST /api/enquiries  send an enquiry about a project  (customer)  47
 *   GET  /api/enquiries  enquiries I received             (designer)
 */
class EnquiryBoundary extends BaseBoundary {
    constructor({ createEnquiryController, viewEnquiryController, authMiddleware, roleMiddleware }) {
        super();
        this.createEnquiryController = createEnquiryController;
        this.viewEnquiryController = viewEnquiryController;
        this.authMiddleware = authMiddleware;
        this.roleMiddleware = roleMiddleware;
    }

    registerRoutes() {
        const loggedIn = this.authMiddleware.requireLogin;
        this.router.post('/enquiries', loggedIn, this.roleMiddleware.requireRole(ROLES.CUSTOMER), this.handle(this.createEnquiry));
        this.router.get('/enquiries', loggedIn, this.roleMiddleware.requireRole(ROLES.DESIGNER), this.handle(this.viewEnquiries));
    }

    createEnquiry(req, res) {
        res.status(201).json({ enquiry: this.createEnquiryController.createEnquiry(req.body ?? {}, req.user) });
    }

    viewEnquiries(req, res) {
        res.json({ enquiries: this.viewEnquiryController.viewEnquiries(req.user) });
    }
}

module.exports = EnquiryBoundary;
