'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES, CREDENTIAL_STATUS } = require('../constants');

/**
 * Story 19: an interior designer submits company credentials for verification.
 * Resubmitting while pending replaces the details; resubmitting after a rejection creates a new submission.
 */
class SubmitCredentialsController {
    constructor({ credentialEntity }) {
        this.credentialEntity = credentialEntity;
    }

    submitCredentials(input = {}, actor) {
        BaseController.requireActor(actor);
        if (actor.role !== ROLES.DESIGNER) {
            throw new AppError(403, 'Only interior designers submit company credentials.');
        }
        const companyName = Validator.requiredText(input.companyName, 'Company name', 100);
        const registrationNumber = Validator.requiredText(input.registrationNumber, 'Company registration number', 50);

        const latest = this.credentialEntity.findLatestByUserId(actor.id);
        if (latest?.status === CREDENTIAL_STATUS.APPROVED) {
            throw new AppError(400, 'Your company credentials are already approved.');
        }

        if (latest?.status === CREDENTIAL_STATUS.PENDING) {
            this.credentialEntity.updatePending(latest.id, { companyName, registrationNumber });
        } else {
            this.credentialEntity.create({ userId: actor.id, companyName, registrationNumber });
        }
        return this.credentialEntity.findLatestByUserId(actor.id);
    }
}

module.exports = SubmitCredentialsController;
