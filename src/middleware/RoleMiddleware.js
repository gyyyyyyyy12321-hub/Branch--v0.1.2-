'use strict';

const AppError = require('../utils/AppError');

/**
 * Restricts a route to certain roles. Use it after AuthMiddleware.requireLogin:
 *   router.post('/x', auth.requireLogin, role.requireRole(ROLES.CUSTOMER), handler)
 */
class RoleMiddleware {
    requireRole(...allowedRoles) {
        return (req, res, next) => {
            if (!req.user) {
                return next(new AppError(401, 'Please log in to continue.'));
            }
            if (!allowedRoles.includes(req.user.role)) {
                return next(new AppError(403, 'You do not have permission to do that.'));
            }
            next();
        };
    }
}

module.exports = RoleMiddleware;
