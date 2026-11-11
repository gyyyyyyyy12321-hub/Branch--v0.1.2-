'use strict';

const AppError = require('../utils/AppError');
const { ROLES } = require('../constants');

/**
 * Permission helpers shared by Controls (the C in BCE). `actor` is req.user: { id, email, role, status }.
 * Routes use RoleMiddleware for coarse access; Controls enforce the finer rules (own account only, etc.).
 * Wrong-password errors use 400, never 401, because the front end treats 401 as "session expired".
 */
class BaseController {
    static isAdmin(actor) {
        return actor?.role === ROLES.USER_ADMIN;
    }

    static requireActor(actor) {
        if (!actor) throw new AppError(401, 'Please log in to continue.');
        return actor;
    }

    static requireAdmin(actor) {
        BaseController.requireActor(actor);
        if (!BaseController.isAdmin(actor)) throw new AppError(403, 'Only a User Admin can do that.');
    }

    /** The actor must be logged in and have exactly this role. */
    static requireRole(actor, role, message = 'You do not have permission to do that.') {
        BaseController.requireActor(actor);
        if (actor.role !== role) throw new AppError(403, message);
    }

    /** The actor may act on userId if it is their own account, or they are a User Admin. */
    static requireSelfOrAdmin(userId, actor) {
        BaseController.requireActor(actor);
        if (actor.id !== userId && !BaseController.isAdmin(actor)) {
            throw new AppError(403, 'You can only access your own account.');
        }
    }

    /** Only customers and designers may deactivate or delete their own account. */
    static requireSelfServiceRole(user) {
        if (![ROLES.CUSTOMER, ROLES.DESIGNER].includes(user.role)) {
            throw new AppError(403, 'Only customers and interior designers can do that to their own account.');
        }
    }
}

module.exports = BaseController;
