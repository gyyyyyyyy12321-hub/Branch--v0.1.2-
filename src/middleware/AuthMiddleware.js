'use strict';

const AppError = require('../utils/AppError');
const CookieParser = require('../utils/CookieParser');
const { ACCOUNT_STATUS } = require('../constants');

const BLOCKED = {
    [ACCOUNT_STATUS.PENDING]: { message: 'Your account is awaiting approval.', code: 'ACCOUNT_PENDING' },
    [ACCOUNT_STATUS.SUSPENDED]: { message: 'Your account has been suspended. Please contact an administrator.', code: 'ACCOUNT_SUSPENDED' },
    [ACCOUNT_STATUS.DEACTIVATED]: { message: 'Your account is deactivated. Reactivate it to continue.', code: 'ACCOUNT_DEACTIVATED' }
};

/**
 * Identifies who is making a request.
 *   authenticate             : runs on every request; sets req.user (or null). Never blocks.
 *   requireLogin             : only logged-in users with an Active account.
 *   requireLoginAllowPending : also lets a Pending account through (a designer waiting for approval
 *                              must be able to see and submit their company credentials).
 * The role and status are read from the database on each request, so a suspension or
 * role change takes effect immediately, even for a token that was issued earlier.
 */
class AuthMiddleware {
    constructor({ userEntity, tokenService, cookieName }) {
        this.userEntity = userEntity;
        this.tokenService = tokenService;
        this.cookieName = cookieName;
    }

    authenticate = (req, res, next) => {
        req.user = null;
        const payload = this.tokenService.verify(this.#extractToken(req));
        if (payload) {
            const row = this.userEntity.findById(payload.sub);
            if (row) {
                req.user = { id: row.id, email: row.email, role: row.role, status: row.status };
            }
        }
        next();
    };

    requireLogin = (req, res, next) => this.#check(req, next, [ACCOUNT_STATUS.ACTIVE]);

    requireLoginAllowPending = (req, res, next) =>
        this.#check(req, next, [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.PENDING]);

    #check(req, next, allowedStatuses) {
        if (!req.user) {
            return next(new AppError(401, 'Please log in to continue.'));
        }
        if (!allowedStatuses.includes(req.user.status)) {
            const blocked = BLOCKED[req.user.status]
                || { message: 'This account cannot be used right now.', code: 'ACCOUNT_BLOCKED' };
            return next(new AppError(403, blocked.message, blocked.code));
        }
        next();
    }

    #extractToken(req) {
        const header = req.headers.authorization || '';
        if (header.startsWith('Bearer ')) return header.slice(7);
        return CookieParser.parse(req.headers.cookie)[this.cookieName] || null;
    }
}

module.exports = AuthMiddleware;
