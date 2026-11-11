'use strict';

// Sprint 1: log in and log out for all four roles.
//   Login:  14 (User Admin), 26 (Interior Designer), 39 (Customer), 53 (Platform Management)
//   Logout: 15 (User Admin), 27 (Interior Designer), 40 (Customer), 54 (Platform Management)
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { buildTestApp, assertRefused, PASSWORD, ROLES, ACCOUNT_STATUS } = require('../helpers/testApp');

let t;
beforeEach(() => { t = buildTestApp(); });

const LOGIN_STORY = { [ROLES.USER_ADMIN]: 14, [ROLES.DESIGNER]: 26, [ROLES.CUSTOMER]: 39, [ROLES.PLATFORM_MANAGEMENT]: 53 };
const LOGOUT_STORY = { [ROLES.USER_ADMIN]: 15, [ROLES.DESIGNER]: 27, [ROLES.CUSTOMER]: 40, [ROLES.PLATFORM_MANAGEMENT]: 54 };

for (const role of Object.values(ROLES)) {
    describe(`Login and logout as ${role}`, () => {
        it(`[${LOGIN_STORY[role]}] logs in with the correct email and password`, () => {
            const user = t.makeUser({ role });
            const { token, account } = t.c.login.login({ email: user.email, password: PASSWORD });
            assert.equal(typeof token, 'string');
            assert.equal(account.id, user.id);
            assert.equal(account.role, role);
            assert.equal(account.password_hash, undefined);
        });

        it(`[${LOGIN_STORY[role]}] issues a token that identifies the user`, () => {
            const user = t.makeUser({ role });
            const { token } = t.c.login.login({ email: user.email, password: PASSWORD });
            assert.equal(t.app.tokenService.verify(token).sub, user.id);
        });

        it(`[${LOGIN_STORY[role]}] refuses a wrong password`, () => {
            const user = t.makeUser({ role });
            assertRefused(() => t.c.login.login({ email: user.email, password: 'wrong-password' }), 401, 'Invalid email or password.');
        });

        it(`[${LOGOUT_STORY[role]}] logs out`, () => {
            const result = t.c.logout.logout();
            assert.equal(result.message, 'You have been logged out.');
        });
    });
}

describe('Login rules that apply to every role', () => {
    it('[14, 26, 39, 53] gives the same message for an unknown email as for a wrong password', () => {
        const user = t.makeUser();
        let wrongPassword, unknownEmail;
        try { t.c.login.login({ email: user.email, password: 'wrong-password' }); } catch (e) { wrongPassword = e.message; }
        try { t.c.login.login({ email: 'nobody@example.com', password: PASSWORD }); } catch (e) { unknownEmail = e.message; }
        assert.equal(wrongPassword, unknownEmail);
    });

    it('[14, 26, 39, 53] refuses missing email or password', () => {
        assertRefused(() => t.c.login.login({}), 401);
        assertRefused(() => t.c.login.login(), 401);
    });

    it('[14, 26, 39, 53] refuses a Suspended account with a SUSPENDED code', () => {
        const user = t.makeUser({ status: ACCOUNT_STATUS.SUSPENDED });
        assert.throws(() => t.c.login.login({ email: user.email, password: PASSWORD }),
            e => e.statusCode === 403 && e.code === 'ACCOUNT_SUSPENDED');
    });

    it('[14, 26, 39, 53] refuses a Deactivated account with a DEACTIVATED code so the page can offer reactivation', () => {
        const user = t.makeUser({ status: ACCOUNT_STATUS.DEACTIVATED });
        assert.throws(() => t.c.login.login({ email: user.email, password: PASSWORD }),
            e => e.statusCode === 403 && e.code === 'ACCOUNT_DEACTIVATED');
    });

    it('[39] refuses a Pending customer, who is still awaiting approval', () => {
        const user = t.makeUser({ role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.PENDING });
        assert.throws(() => t.c.login.login({ email: user.email, password: PASSWORD }),
            e => e.statusCode === 403 && e.code === 'ACCOUNT_PENDING');
    });

    it('[26] lets a Pending designer log in so they can submit company credentials', () => {
        const user = t.makeUser({ role: ROLES.DESIGNER, status: ACCOUNT_STATUS.PENDING });
        const { account } = t.c.login.login({ email: user.email, password: PASSWORD });
        assert.equal(account.status, ACCOUNT_STATUS.PENDING);
    });
});
