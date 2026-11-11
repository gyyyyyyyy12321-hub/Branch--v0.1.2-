'use strict';

const AppError = require('../utils/AppError');
const PasswordHasher = require('../utils/PasswordHasher');
const Validator = require('../utils/Validator');
const BaseController = require('./BaseController');
const { ROLES, ACCOUNT_STATUS, CREDENTIAL_STATUS } = require('../constants');

/**
 * Stories 1, 17, 33: create a user account.
 *   Public sign-up (actor null): Customer or Interior Designer only. Designers start Pending and must give a
 *   company registration number, which is stored as their first credential submission (story 19).
 *   User Admin: any role, status Active or Pending.
 */
class CreateUserAccountController {
    constructor({ db, userEntity, profileEntity, credentialEntity }) {
        this.db = db;
        this.userEntity = userEntity;
        this.profileEntity = profileEntity;
        this.credentialEntity = credentialEntity;
    }

    createUserAccount(input = {}, actor = null) {
        const byAdmin = BaseController.isAdmin(actor);

        const email = Validator.email(input.email);
        const password = Validator.password(input.password);
        const name = Validator.requiredText(input.name, 'Name', 100);
        const role = Validator.oneOf(
            input.role,
            byAdmin ? Object.values(ROLES) : [ROLES.CUSTOMER, ROLES.DESIGNER],
            'Account type'
        );

        let status;
        if (byAdmin) {
            status = Validator.oneOf(input.status ?? ACCOUNT_STATUS.ACTIVE, [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.PENDING], 'Status');
        } else {
            status = role === ROLES.DESIGNER ? ACCOUNT_STATUS.PENDING : ACCOUNT_STATUS.ACTIVE;
        }

        let registrationNumber = null;
        if (role === ROLES.DESIGNER) {
            registrationNumber = byAdmin
                ? Validator.optionalText(input.registrationNumber, 'Company registration number', 50)
                : Validator.requiredText(input.registrationNumber, 'Company registration number', 50);
        }

        if (this.userEntity.findByEmail(email)) {
            throw new AppError(409, 'An account with this email already exists.');
        }

        const passwordHash = PasswordHasher.hash(password);
        let userId;
        try {
            userId = this.db.transaction(() => {
                const id = this.userEntity.create({ email, passwordHash, role, status });
                this.profileEntity.create(id, { name });
                if (registrationNumber) {
                    this.credentialEntity.create({
                        userId: id,
                        companyName: name,
                        registrationNumber,
                        status: status === ACCOUNT_STATUS.ACTIVE ? CREDENTIAL_STATUS.APPROVED : CREDENTIAL_STATUS.PENDING
                    });
                }
                return id;
            });
        } catch (err) {
            if (/UNIQUE/i.test(err.message)) throw new AppError(409, 'An account with this email already exists.');
            throw err;
        }
        return this.userEntity.findAccountById(userId);
    }
}

module.exports = CreateUserAccountController;
