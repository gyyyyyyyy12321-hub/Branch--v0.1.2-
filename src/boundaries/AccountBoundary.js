'use strict';

const BaseBoundary = require('./BaseBoundary');
const { ROLES } = require('../constants');

/**
 * Account routes (all need a logged-in, Active user; admin-only ones say so):
 *   POST   /api/accounts                      create an account            (admin)
 *   GET    /api/accounts                      search accounts              (admin)  ?query=&role=&status=
 *   GET    /api/accounts/:id                  view an account              (self or admin)
 *   PATCH  /api/accounts/:id                  update email / password      (self or admin)
 *   DELETE /api/accounts/:id                  delete an account            (self with password, or admin)
 *   POST   /api/accounts/:id/role             assign a role                (admin)
 *   POST   /api/accounts/:id/suspend          suspend                      (admin)
 *   POST   /api/accounts/:id/deactivate       deactivate                   (self or admin)
 *   POST   /api/accounts/:id/reactivate       reactivate                   (admin)
 *   POST   /api/accounts/:id/approve          approve a pending account    (admin)
 *   POST   /api/accounts/:id/reject           reject pending credentials   (admin)
 *   POST   /api/accounts/:id/reset-password   reset a password             (admin)
 * Fine-grained permission rules live in the Controls.
 */
class AccountBoundary extends BaseBoundary {
    constructor({
        createUserAccountController, searchUserAccountController, viewUserAccountController,
        updateUserAccountController, deleteUserAccountController, assignUserRoleController,
        suspendUserAccountController, deactivateUserAccountController, reactivateUserAccountController,
        approveUserAccountController, rejectUserAccountController, resetUserPasswordController,
        authMiddleware, roleMiddleware
    }) {
        super();
        this.createUserAccountController = createUserAccountController;
        this.searchUserAccountController = searchUserAccountController;
        this.viewUserAccountController = viewUserAccountController;
        this.updateUserAccountController = updateUserAccountController;
        this.deleteUserAccountController = deleteUserAccountController;
        this.assignUserRoleController = assignUserRoleController;
        this.suspendUserAccountController = suspendUserAccountController;
        this.deactivateUserAccountController = deactivateUserAccountController;
        this.reactivateUserAccountController = reactivateUserAccountController;
        this.approveUserAccountController = approveUserAccountController;
        this.rejectUserAccountController = rejectUserAccountController;
        this.resetUserPasswordController = resetUserPasswordController;
        this.authMiddleware = authMiddleware;
        this.roleMiddleware = roleMiddleware;
    }

    registerRoutes() {
        const loggedIn = this.authMiddleware.requireLogin;
        const adminOnly = [loggedIn, this.roleMiddleware.requireRole(ROLES.USER_ADMIN)];

        this.router.post('/accounts', ...adminOnly, this.handle(this.createAccount));
        this.router.get('/accounts', ...adminOnly, this.handle(this.searchAccounts));
        this.router.get('/accounts/:id', loggedIn, this.handle(this.viewAccount));
        this.router.patch('/accounts/:id', loggedIn, this.handle(this.updateAccount));
        this.router.delete('/accounts/:id', loggedIn, this.handle(this.deleteAccount));
        this.router.post('/accounts/:id/role', ...adminOnly, this.handle(this.assignRole));
        this.router.post('/accounts/:id/suspend', ...adminOnly, this.handle(this.suspendAccount));
        this.router.post('/accounts/:id/deactivate', loggedIn, this.handle(this.deactivateAccount));
        this.router.post('/accounts/:id/reactivate', ...adminOnly, this.handle(this.reactivateAccount));
        this.router.post('/accounts/:id/approve', ...adminOnly, this.handle(this.approveAccount));
        this.router.post('/accounts/:id/reject', ...adminOnly, this.handle(this.rejectAccount));
        this.router.post('/accounts/:id/reset-password', ...adminOnly, this.handle(this.resetPassword));
    }

    createAccount(req, res) {
        const account = this.createUserAccountController.createUserAccount(req.body ?? {}, req.user);
        res.status(201).json({ account });
    }

    searchAccounts(req, res) {
        res.json({ accounts: this.searchUserAccountController.searchUserAccounts(req.query ?? {}, req.user) });
    }

    viewAccount(req, res) {
        res.json({ account: this.viewUserAccountController.viewUserAccount(req.params.id, req.user) });
    }

    updateAccount(req, res) {
        res.json({ account: this.updateUserAccountController.updateUserAccount(req.params.id, req.body ?? {}, req.user) });
    }

    deleteAccount(req, res) {
        res.json(this.deleteUserAccountController.deleteUserAccount(req.params.id, req.user, req.body ?? {}));
    }

    assignRole(req, res) {
        res.json({ account: this.assignUserRoleController.assignUserRole(req.params.id, req.body ?? {}, req.user) });
    }

    suspendAccount(req, res) {
        res.json({ account: this.suspendUserAccountController.suspendUserAccount(req.params.id, req.user) });
    }

    deactivateAccount(req, res) {
        res.json({ account: this.deactivateUserAccountController.deactivateUserAccount(req.params.id, req.user) });
    }

    reactivateAccount(req, res) {
        res.json({ account: this.reactivateUserAccountController.reactivateUserAccount(req.params.id, req.user) });
    }

    approveAccount(req, res) {
        res.json({ account: this.approveUserAccountController.approveUserAccount(req.params.id, req.user) });
    }

    rejectAccount(req, res) {
        res.json({ account: this.rejectUserAccountController.rejectUserAccount(req.params.id, req.user) });
    }

    resetPassword(req, res) {
        res.json(this.resetUserPasswordController.resetUserPassword(req.params.id, req.user));
    }
}

module.exports = AccountBoundary;
