'use strict';

const AppError = require('../utils/AppError');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES, ACCOUNT_STATUS, CREDENTIAL_STATUS } = require('../constants');

/**
 * Story 4: a User Admin approves a Pending account.
 * A designer must have a pending credential submission; approving marks it Approved and activates the account.
 */
class ApproveUserAccountController {
    constructor({ db, userEntity, credentialEntity }) {
        this.db = db;
        this.userEntity = userEntity;
        this.credentialEntity = credentialEntity;
    }

    approveUserAccount(userId, actor) {
        BaseController.requireAdmin(actor);
        const id = Validator.id(userId, 'user id');
        const user = this.userEntity.findById(id);
        if (!user) throw new AppError(404, 'User account not found.');
        if (user.status !== ACCOUNT_STATUS.PENDING) {
            throw new AppError(400, 'Only pending accounts can be approved.');
        }

        let credential = null;
        if (user.role === ROLES.DESIGNER) {
            credential = this.credentialEntity.findLatestByUserId(id);
            if (!credential) {
                throw new AppError(400, 'This company has not submitted credentials yet.');
            }
            if (credential.status === CREDENTIAL_STATUS.REJECTED) {
                throw new AppError(400, 'These credentials were rejected. The company must submit them again.');
            }
        }

        this.db.transaction(() => {
            if (credential) this.credentialEntity.review(credential.id, CREDENTIAL_STATUS.APPROVED);
            this.userEntity.updateStatus(id, ACCOUNT_STATUS.ACTIVE);
        });
        return this.userEntity.findAccountById(id);
    }
}

module.exports = ApproveUserAccountController;
