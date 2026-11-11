'use strict';

/**
 * Stories 15, 27, 40, 54: log out.
 * Sessions are stateless tokens held in a cookie, so ending one means the Boundary clears the cookie.
 */
class LogoutController {
    logout() {
        return { message: 'You have been logged out.' };
    }
}

module.exports = LogoutController;
