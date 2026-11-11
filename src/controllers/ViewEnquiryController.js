'use strict';

const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/**
 * Supports story 47 (not a story of its own): a designer reads the enquiries customers sent them,
 * otherwise sending an enquiry would lead nowhere.
 */
class ViewEnquiryController {
    constructor({ enquiryEntity }) {
        this.enquiryEntity = enquiryEntity;
    }

    viewEnquiries(actor) {
        BaseController.requireRole(actor, ROLES.DESIGNER, 'Only interior designers receive enquiries.');
        return this.enquiryEntity.findByDesigner(actor.id);
    }
}

module.exports = ViewEnquiryController;
