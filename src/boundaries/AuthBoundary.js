'use strict';

const BaseBoundary = require('./BaseBoundary');

/**
 * Public and session routes:
 *   POST /api/auth/register    create a Customer or Interior Designer account
 *   POST /api/auth/login       log in (sets the session cookie)
 *   POST /api/auth/logout      log out (clears the cookie)
 *   POST /api/auth/reactivate  reactivate your own deactivated account (email + password)
 *   GET  /api/auth/me          the logged-in account (used by the front end on page load)
 */
class AuthBoundary extends BaseBoundary {
    constructor({
        createUserAccountController, loginController, logoutController,
        reactivateUserAccountController, viewUserAccountController,
        authMiddleware, cookie
    }) {
        super();
        this.createUserAccountController = createUserAccountController;
        this.loginController = loginController;
        this.logoutController = logoutController;
        this.reactivateUserAccountController = reactivateUserAccountController;
        this.viewUserAccountController = viewUserAccountController;
        this.authMiddleware = authMiddleware;
        this.cookie = cookie; // { name, maxAgeMs, secure }
    }

    registerRoutes() {
        this.router.post('/auth/register', this.handle(this.register));
        this.router.post('/auth/login', this.handle(this.login));
        this.router.post('/auth/logout', this.handle(this.logout));
        this.router.post('/auth/reactivate', this.handle(this.reactivate));
        this.router.get('/auth/me', this.authMiddleware.requireLoginAllowPending, this.handle(this.me));
    }

    register(req, res) {
        // Always public sign-up rules here; admins create accounts through /api/accounts.
        const account = this.createUserAccountController.createUserAccount(req.body ?? {}, null);
        res.status(201).json({ account });
    }

    login(req, res) {
        const { token, account } = this.loginController.login(req.body ?? {});
        res.cookie(this.cookie.name, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: this.cookie.secure,
            maxAge: this.cookie.maxAgeMs
        });
        res.json({ account });
    }

    logout(req, res) {
        const result = this.logoutController.logout();
        res.clearCookie(this.cookie.name);
        res.json(result);
    }

    reactivate(req, res) {
        const account = this.reactivateUserAccountController.reactivateOwnUserAccount(req.body ?? {});
        res.json({ account });
    }

    me(req, res) {
        res.json({ account: this.viewUserAccountController.viewUserAccount(req.user.id, req.user) });
    }
}

module.exports = AuthBoundary;
