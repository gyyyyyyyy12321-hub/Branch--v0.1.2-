'use strict';

const AppError = require('../utils/AppError');
const PasswordHasher = require('../utils/PasswordHasher');
const { ROLES, ACCOUNT_STATUS } = require('../constants');

/** Stories 14, 26, 39, 53: log in (every role uses the same flow). */
class LoginController {
    constructor({ userEntity, tokenService, ttlSeconds }) {
        this.userEntity = userEntity;
        this.tokenService = tokenService;
        this.ttlSeconds = ttlSeconds;
    }

    /**
     * Returns { token, account }. A Pending designer may log in so they can submit company credentials;
     * every other non-Active status is refused, with a code the front end uses to offer next steps.
     */
    login({ email, password } = {}) {
        const user = this.userEntity.findByEmail(email);
        const passwordOk = PasswordHasher.verifyOptional(password, user?.password_hash);
        if (!user || !passwordOk) {
            throw new AppError(401, 'Invalid email or password.');
        }

        if (user.status === ACCOUNT_STATUS.SUSPENDED) {
            throw new AppError(403, 'Your account has been suspended. Please contact an administrator.', 'ACCOUNT_SUSPENDED');
        }
        if (user.status === ACCOUNT_STATUS.DEACTIVATED) {
            throw new AppError(403, 'Your account is deactivated. You can reactivate it to continue.', 'ACCOUNT_DEACTIVATED');
        }
        if (user.status === ACCOUNT_STATUS.PENDING && user.role !== ROLES.DESIGNER) {
            throw new AppError(403, 'Your account is awaiting approval.', 'ACCOUNT_PENDING');
        }

        const token = this.tokenService.sign({ sub: user.id }, this.ttlSeconds);
        return { token, account: this.userEntity.findAccountById(user.id) };
    }
}

module.exports = LoginController;
