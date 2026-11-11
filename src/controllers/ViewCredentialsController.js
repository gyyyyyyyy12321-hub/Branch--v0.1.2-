'use strict';

const AppError = require('../utils/AppError');
const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/** Supports story 19: a designer views the status of their latest credential submission (or null if none). */
class ViewCredentialsController {
    constructor({ credentialEntity }) {
        this.credentialEntity = credentialEntity;
    }

    viewCredentials(actor) {
        BaseController.requireActor(actor);
        if (actor.role !== ROLES.DESIGNER) {
            throw new AppError(403, 'Only interior designers have company credentials.');
        }
        return this.credentialEntity.findLatestByUserId(actor.id);
    }
}

module.exports = ViewCredentialsController;
