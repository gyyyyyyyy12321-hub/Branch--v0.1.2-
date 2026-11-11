'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES, ACCOUNT_STATUS, CREDENTIAL_STATUS } = require('../constants');

/**
 * Companion to story 4 (the wireframe has Approve and Reject): a User Admin rejects a designer's pending credentials.
 * The account stays Pending, and the designer can submit corrected details.
 */
class RejectUserAccountController {
    constructor({ userEntity, credentialEntity }) {
        this.userEntity = userEntity;
        this.credentialEntity = credentialEntity;
    }

    rejectUserAccount(userId, actor) {
        BaseController.requireAdmin(actor);
        const id = Validator.id(userId, 'user id');
        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');
        if (user.role !== ROLES.DESIGNER || user.status !== ACCOUNT_STATUS.PENDING) {
            throw new AppError(400, 'Only pending designer accounts can be rejected.');
        }

        const credential = this.credentialEntity.findLatestByUserId(id);
        if (!credential || credential.status !== CREDENTIAL_STATUS.PENDING) {
            throw new AppError(400, 'There are no pending credentials to reject.');
        }

        this.credentialEntity.review(credential.id, CREDENTIAL_STATUS.REJECTED);
        return this.userEntity.findAccountById(id);
    }
}

module.exports = RejectUserAccountController;
