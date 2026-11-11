'use strict';

// Sprint 1, User Admin stories 1-10 and 16 (account management).
// Each test name starts with the story number so a failure can be traced back to the user story.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { buildTestApp, assertRefused, PASSWORD, ROLES, ACCOUNT_STATUS } = require('../helpers/testApp');

let t, admin;
beforeEach(() => {
    t = buildTestApp();
    admin = t.makeUser({ role: ROLES.USER_ADMIN, name: 'Admin One' });
});

describe('Story 1: create a user account (User Admin)', () => {
    const valid = { email: 'new@example.com', password: PASSWORD, name: 'New Person', role: ROLES.CUSTOMER };

    it('[1] creates an account with the chosen role and an Active status by default', () => {
        const account = t.c.createUserAccount.createUserAccount(valid, admin);
        assert.equal(account.email, 'new@example.com');
        assert.equal(account.role, ROLES.CUSTOMER);
        assert.equal(account.status, ACCOUNT_STATUS.ACTIVE);
        assert.equal(account.name, 'New Person');
    });

    it('[1] lets the admin create any of the four roles', () => {
        for (const [i, role] of Object.values(ROLES).entries()) {
            const account = t.c.createUserAccount.createUserAccount({ ...valid, email: `r${i}@example.com`, role }, admin);
            assert.equal(account.role, role);
        }
    });

    it('[1] stores only a salted hash, never the password, and never returns the hash', () => {
        const account = t.c.createUserAccount.createUserAccount(valid, admin);
        const row = t.entities.user.findById(account.id);
        assert.ok(row.password_hash.startsWith('scrypt$'));
        assert.ok(!row.password_hash.includes(PASSWORD));
        assert.equal(account.password_hash, undefined);
        assert.equal(account.passwordHash, undefined);
    });

    it('[1] creates a Pending account when the admin asks for one', () => {
        const account = t.c.createUserAccount.createUserAccount({ ...valid, status: ACCOUNT_STATUS.PENDING }, admin);
        assert.equal(account.status, ACCOUNT_STATUS.PENDING);
    });

    it('[1] gives an admin-created designer an Approved credential when Active, Pending credential when Pending', () => {
        const active = t.c.createUserAccount.createUserAccount(
            { ...valid, email: 'd1@example.com', role: ROLES.DESIGNER, registrationNumber: 'REG-1' }, admin);
        assert.equal(active.credentialStatus, 'Approved');
        const pending = t.c.createUserAccount.createUserAccount(
            { ...valid, email: 'd2@example.com', role: ROLES.DESIGNER, registrationNumber: 'REG-2', status: ACCOUNT_STATUS.PENDING }, admin);
        assert.equal(pending.credentialStatus, 'Pending');
    });

    it('[1] refuses a duplicate email, ignoring upper/lower case', () => {
        t.c.createUserAccount.createUserAccount(valid, admin);
        assertRefused(() => t.c.createUserAccount.createUserAccount({ ...valid, email: 'NEW@Example.com' }, admin),
            409, 'An account with this email already exists.');
    });

    it('[1] refuses a bad email, a short password, an empty name and an unknown role', () => {
        const create = input => () => t.c.createUserAccount.createUserAccount({ ...valid, ...input }, admin);
        assertRefused(create({ email: 'not-an-email' }), 400);
        assertRefused(create({ password: 'short' }), 400);
        assertRefused(create({ name: '   ' }), 400);
        assertRefused(create({ role: 'Janitor' }), 400);
    });

    it('[1] refuses an admin choosing a status other than Active or Pending', () => {
        assertRefused(() => t.c.createUserAccount.createUserAccount({ ...valid, status: ACCOUNT_STATUS.SUSPENDED }, admin), 400);
    });

    it('[1] saves nothing when a request is refused', () => {
        const before = t.entities.user.count();
        assertRefused(() => t.c.createUserAccount.createUserAccount({ ...valid, password: 'short' }, admin), 400);
        assert.equal(t.entities.user.count(), before);
    });

    it('[1] does not let someone who is not an admin create a User Admin account', () => {
        assertRefused(() => t.c.createUserAccount.createUserAccount({ ...valid, role: ROLES.USER_ADMIN }, null), 400);
        const customer = t.makeUser();
        assertRefused(() => t.c.createUserAccount.createUserAccount({ ...valid, role: ROLES.USER_ADMIN }, customer), 400);
    });
});

describe('Story 2: view a user account', () => {
    it('[2] lets the admin view any account without the password hash', () => {
        const user = t.makeUser({ name: 'Viewed Person' });
        const account = t.c.viewUserAccount.viewUserAccount(user.id, admin);
        assert.equal(account.email, user.email);
        assert.equal(account.name, 'Viewed Person');
        assert.equal(account.role, ROLES.CUSTOMER);
        assert.equal(account.status, ACCOUNT_STATUS.ACTIVE);
        assert.equal(account.password_hash, undefined);
    });

    it('[2] shows the latest credential status for a designer', () => {
        const designer = t.makeUser({ role: ROLES.DESIGNER, status: ACCOUNT_STATUS.PENDING });
        t.entities.credential.create({ userId: designer.id, companyName: 'Studio', registrationNumber: 'R1' });
        const account = t.c.viewUserAccount.viewUserAccount(designer.id, admin);
        assert.equal(account.credentialStatus, 'Pending');
        assert.equal(account.registrationNumber, 'R1');
    });

    it('[2] refuses a user who is neither the owner nor an admin', () => {
        const a = t.makeUser(); const b = t.makeUser();
        assertRefused(() => t.c.viewUserAccount.viewUserAccount(b.id, a), 403, 'You can only access your own account.');
    });

    it('[2] refuses someone who is not logged in', () => {
        assertRefused(() => t.c.viewUserAccount.viewUserAccount(admin.id, null), 401);
    });

    it('[2] reports an account that does not exist', () => {
        assertRefused(() => t.c.viewUserAccount.viewUserAccount(9999, admin), 404, 'User account not found.');
    });
});

describe('Story 3: assign a role to a user account', () => {
    it('[3] changes the role of another account', () => {
        const user = t.makeUser();
        const account = t.c.assignUserRole.assignUserRole(user.id, { role: ROLES.PLATFORM_MANAGEMENT }, admin);
        assert.equal(account.role, ROLES.PLATFORM_MANAGEMENT);
        assert.equal(t.accountOf(user).role, ROLES.PLATFORM_MANAGEMENT);
    });

    it('[3] takes effect on the very next request because the role is read from the database', () => {
        const user = t.makeUser();
        t.c.assignUserRole.assignUserRole(user.id, { role: ROLES.USER_ADMIN }, admin);
        assert.equal(t.actorOf(user).role, ROLES.USER_ADMIN);
    });

    it('[3] does not let an admin change their own role', () => {
        assertRefused(() => t.c.assignUserRole.assignUserRole(admin.id, { role: ROLES.CUSTOMER }, admin), 400, /own role/i);
    });

    it('[3] refuses a role that does not exist', () => {
        const user = t.makeUser();
        assertRefused(() => t.c.assignUserRole.assignUserRole(user.id, { role: 'Janitor' }, admin), 400);
    });

    it('[3] reports an account that does not exist', () => {
        assertRefused(() => t.c.assignUserRole.assignUserRole(9999, { role: ROLES.CUSTOMER }, admin), 404, 'User account not found.');
    });

    it('[3] refuses anyone who is not a User Admin', () => {
        const customer = t.makeUser(); const other = t.makeUser();
        assertRefused(() => t.c.assignUserRole.assignUserRole(other.id, { role: ROLES.CUSTOMER }, customer), 403);
        assertRefused(() => t.c.assignUserRole.assignUserRole(other.id, { role: ROLES.CUSTOMER }, null), 401);
    });
});

describe('Story 4: approve (or reject) a pending account', () => {
    const signUpDesigner = (email = 'studio@example.com') => t.c.createUserAccount.createUserAccount(
        { email, password: PASSWORD, name: 'Studio Ltd', role: ROLES.DESIGNER, registrationNumber: 'REG-9' }, null);

    it('[4] approves a pending designer: the account becomes Active and the credential Approved', () => {
        const pending = signUpDesigner();
        assert.equal(pending.status, ACCOUNT_STATUS.PENDING);
        const approved = t.c.approveUserAccount.approveUserAccount(pending.id, admin);
        assert.equal(approved.status, ACCOUNT_STATUS.ACTIVE);
        assert.equal(approved.credentialStatus, 'Approved');
    });

    it('[4] only approves accounts that are Pending', () => {
        const active = t.makeUser();
        assertRefused(() => t.c.approveUserAccount.approveUserAccount(active.id, admin), 400, /pending/i);
    });

    it('[4] will not approve a designer who has not submitted credentials', () => {
        const designer = t.makeUser({ role: ROLES.DESIGNER, status: ACCOUNT_STATUS.PENDING });
        assertRefused(() => t.c.approveUserAccount.approveUserAccount(designer.id, admin), 400, /not submitted credentials/i);
    });

    it('[4] will not approve a designer whose credentials were rejected', () => {
        const pending = signUpDesigner();
        t.c.rejectUserAccount.rejectUserAccount(pending.id, admin);
        assertRefused(() => t.c.approveUserAccount.approveUserAccount(pending.id, admin), 400);
    });

    it('[4] rejecting marks the credential Rejected and leaves the account Pending', () => {
        const pending = signUpDesigner();
        const rejected = t.c.rejectUserAccount.rejectUserAccount(pending.id, admin);
        assert.equal(rejected.credentialStatus, 'Rejected');
        assert.equal(rejected.status, ACCOUNT_STATUS.PENDING);
    });

    it('[4] only pending designer accounts can be rejected', () => {
        const customer = t.makeUser();
        assertRefused(() => t.c.rejectUserAccount.rejectUserAccount(customer.id, admin), 400);
    });

    it('[4] reports an account that does not exist', () => {
        assertRefused(() => t.c.approveUserAccount.approveUserAccount(9999, admin), 404);
    });

    it('[4] refuses anyone who is not a User Admin', () => {
        const pending = signUpDesigner();
        assertRefused(() => t.c.approveUserAccount.approveUserAccount(pending.id, t.makeUser()), 403);
        assertRefused(() => t.c.approveUserAccount.approveUserAccount(pending.id, null), 401);
    });
});

describe('Story 5: search user accounts', () => {
    beforeEach(() => {
        t.makeUser({ name: 'Alice Tan', email: 'alice@example.com' });
        t.makeUser({ name: 'Bob Lim', email: 'bob@work.test', role: ROLES.DESIGNER });
        t.makeUser({ name: 'Carol Ng', email: 'carol@example.com', status: ACCOUNT_STATUS.SUSPENDED });
    });
    const search = filters => t.c.searchUserAccount.searchUserAccounts(filters, admin);

    it('[5] finds accounts by part of the name, ignoring case', () => {
        assert.deepEqual(search({ query: 'alice' }).map(a => a.name), ['Alice Tan']);
    });

    it('[5] finds accounts by part of the email', () => {
        assert.deepEqual(search({ query: 'work.test' }).map(a => a.name), ['Bob Lim']);
    });

    it('[5] narrows by role and by status', () => {
        assert.deepEqual(search({ role: ROLES.DESIGNER }).map(a => a.name), ['Bob Lim']);
        assert.deepEqual(search({ status: ACCOUNT_STATUS.SUSPENDED }).map(a => a.name), ['Carol Ng']);
    });

    it('[5] returns every account when no filter is given', () => {
        assert.equal(search({}).length, 4); // three above plus the admin
    });

    it('[5] returns an empty list when nothing matches', () => {
        assert.deepEqual(search({ query: 'zzz-no-such-person' }), []);
    });

    it('[5] treats % and _ typed in the search box as ordinary text, not wildcards', () => {
        assert.deepEqual(search({ query: '%' }), []);
        assert.deepEqual(search({ query: '_' }), []);
    });

    it('[5] refuses an unknown role or status filter', () => {
        assertRefused(() => search({ role: 'Janitor' }), 400);
        assertRefused(() => search({ status: 'Retired' }), 400);
    });

    it('[5] never returns the password hash', () => {
        for (const a of search({})) assert.equal(a.password_hash, undefined);
    });

    it('[5] refuses anyone who is not a User Admin', () => {
        assertRefused(() => t.c.searchUserAccount.searchUserAccounts({}, t.makeUser()), 403);
        assertRefused(() => t.c.searchUserAccount.searchUserAccounts({}, null), 401);
    });
});

describe('Story 6: update a user account', () => {
    it('[6] lets the admin change another user\'s email', () => {
        const user = t.makeUser();
        const account = t.c.updateUserAccount.updateUserAccount(user.id, { email: 'changed@example.com' }, admin);
        assert.equal(account.email, 'changed@example.com');
    });

    it('[6] refuses an email that belongs to another account', () => {
        const a = t.makeUser(); const b = t.makeUser();
        assertRefused(() => t.c.updateUserAccount.updateUserAccount(a.id, { email: b.email }, admin), 409);
    });

    it('[6] refuses an invalid email and changes nothing', () => {
        const user = t.makeUser();
        assertRefused(() => t.c.updateUserAccount.updateUserAccount(user.id, { email: 'nope' }, admin), 400);
        assert.equal(t.accountOf(user).email, user.email);
    });

    it('[6] refuses a request that changes nothing', () => {
        assertRefused(() => t.c.updateUserAccount.updateUserAccount(admin.id, {}, admin), 400, 'Nothing to update.');
    });

    it('[6] lets a user change their own password only with the correct current password', () => {
        const user = t.makeUser();
        assertRefused(() => t.c.updateUserAccount.updateUserAccount(user.id,
            { currentPassword: 'wrong-password', newPassword: 'NewPassword456!' }, user), 400, 'Current password is incorrect.');
        t.c.updateUserAccount.updateUserAccount(user.id, { currentPassword: PASSWORD, newPassword: 'NewPassword456!' }, user);
        assert.ok(t.c.login.login({ email: user.email, password: 'NewPassword456!' }).token);
        assertRefused(() => t.c.login.login({ email: user.email, password: PASSWORD }), 401);
    });

    it('[6] does not let an admin set another user\'s password (reset password is for that)', () => {
        const user = t.makeUser();
        assertRefused(() => t.c.updateUserAccount.updateUserAccount(user.id,
            { currentPassword: PASSWORD, newPassword: 'NewPassword456!' }, admin), 403);
    });

    it('[6] refuses a new password that is too short', () => {
        const user = t.makeUser();
        assertRefused(() => t.c.updateUserAccount.updateUserAccount(user.id, { currentPassword: PASSWORD, newPassword: 'short' }, user), 400);
    });
});

describe('Story 7: suspend a user account', () => {
    it('[7] suspends an Active account', () => {
        const user = t.makeUser();
        const account = t.c.suspendUserAccount.suspendUserAccount(user.id, admin);
        assert.equal(account.status, ACCOUNT_STATUS.SUSPENDED);
    });

    it('[7] stops the suspended user logging in', () => {
        const user = t.makeUser();
        t.c.suspendUserAccount.suspendUserAccount(user.id, admin);
        assertRefused(() => t.c.login.login({ email: user.email, password: PASSWORD }), 403, /suspended/i);
    });

    it('[7] only suspends Active accounts', () => {
        const user = t.makeUser({ status: ACCOUNT_STATUS.DEACTIVATED });
        assertRefused(() => t.c.suspendUserAccount.suspendUserAccount(user.id, admin), 400, 'Only active accounts can be suspended.');
    });

    it('[7] does not let an admin suspend themselves', () => {
        assertRefused(() => t.c.suspendUserAccount.suspendUserAccount(admin.id, admin), 400, 'You cannot suspend your own account.');
    });

    it('[7] reports an account that does not exist', () => {
        assertRefused(() => t.c.suspendUserAccount.suspendUserAccount(9999, admin), 404);
    });

    it('[7] refuses anyone who is not a User Admin', () => {
        assertRefused(() => t.c.suspendUserAccount.suspendUserAccount(t.makeUser().id, t.makeUser()), 403);
    });
});

describe('Story 8: delete a user account (admin)', () => {
    it('[8] deletes another user\'s account and their profile', () => {
        const user = t.makeUser();
        const result = t.c.deleteUserAccount.deleteUserAccount(user.id, admin);
        assert.equal(result.message, 'Account deleted.');
        assert.equal(t.accountOf(user), null);
        assert.equal(t.entities.profile.findByUserId(user.id), null);
    });

    it('[8] does not let an admin delete their own account', () => {
        assertRefused(() => t.c.deleteUserAccount.deleteUserAccount(admin.id, admin), 400, 'An admin cannot delete their own account.');
    });

    it('[8] reports an account that does not exist', () => {
        assertRefused(() => t.c.deleteUserAccount.deleteUserAccount(9999, admin), 404);
    });

    it('[8] refuses a user deleting someone else\'s account', () => {
        assertRefused(() => t.c.deleteUserAccount.deleteUserAccount(t.makeUser().id, t.makeUser()), 403);
    });
});

describe('Story 9: deactivate a user account (admin)', () => {
    it('[9] deactivates an Active account', () => {
        const user = t.makeUser();
        assert.equal(t.c.deactivateUserAccount.deactivateUserAccount(user.id, admin).status, ACCOUNT_STATUS.DEACTIVATED);
    });

    it('[9] only deactivates Active accounts', () => {
        const user = t.makeUser({ status: ACCOUNT_STATUS.SUSPENDED });
        assertRefused(() => t.c.deactivateUserAccount.deactivateUserAccount(user.id, admin), 400, 'Only active accounts can be deactivated.');
    });

    it('[9] does not let an admin deactivate their own account', () => {
        assertRefused(() => t.c.deactivateUserAccount.deactivateUserAccount(admin.id, admin), 400, /own account/);
    });

    it('[9] refuses a user deactivating someone else', () => {
        assertRefused(() => t.c.deactivateUserAccount.deactivateUserAccount(t.makeUser().id, t.makeUser()), 403);
    });
});

describe('Story 10: reactivate a user account (admin)', () => {
    it('[10] reactivates a deactivated account', () => {
        const user = t.makeUser({ status: ACCOUNT_STATUS.DEACTIVATED });
        assert.equal(t.c.reactivateUserAccount.reactivateUserAccount(user.id, admin).status, ACCOUNT_STATUS.ACTIVE);
    });

    it('[10] reactivates a suspended account', () => {
        const user = t.makeUser({ status: ACCOUNT_STATUS.SUSPENDED });
        assert.equal(t.c.reactivateUserAccount.reactivateUserAccount(user.id, admin).status, ACCOUNT_STATUS.ACTIVE);
    });

    it('[10] lets the user log in again afterwards', () => {
        const user = t.makeUser({ status: ACCOUNT_STATUS.SUSPENDED });
        t.c.reactivateUserAccount.reactivateUserAccount(user.id, admin);
        assert.ok(t.c.login.login({ email: user.email, password: PASSWORD }).token);
    });

    it('[10] refuses an account that is already Active', () => {
        assertRefused(() => t.c.reactivateUserAccount.reactivateUserAccount(t.makeUser().id, admin), 400, /suspended or deactivated/i);
    });

    it('[10] refuses anyone who is not a User Admin', () => {
        const user = t.makeUser({ status: ACCOUNT_STATUS.DEACTIVATED });
        assertRefused(() => t.c.reactivateUserAccount.reactivateUserAccount(user.id, t.makeUser()), 403);
    });
});

describe('Story 16: reset a user\'s password', () => {
    it('[16] gives the admin a temporary password once, and the user can log in with it', () => {
        const user = t.makeUser();
        const { temporaryPassword } = t.c.resetUserPassword.resetUserPassword(user.id, admin);
        assert.equal(typeof temporaryPassword, 'string');
        assert.equal(temporaryPassword.length, 12);
        assert.ok(t.c.login.login({ email: user.email, password: temporaryPassword }).token);
    });

    it('[16] stops the old password working', () => {
        const user = t.makeUser();
        t.c.resetUserPassword.resetUserPassword(user.id, admin);
        assertRefused(() => t.c.login.login({ email: user.email, password: PASSWORD }), 401);
    });

    it('[16] stores the temporary password only as a hash', () => {
        const user = t.makeUser();
        const { temporaryPassword } = t.c.resetUserPassword.resetUserPassword(user.id, admin);
        assert.ok(!t.entities.user.findById(user.id).password_hash.includes(temporaryPassword));
    });

    it('[16] gives a different temporary password each time', () => {
        const user = t.makeUser();
        const a = t.c.resetUserPassword.resetUserPassword(user.id, admin).temporaryPassword;
        const b = t.c.resetUserPassword.resetUserPassword(user.id, admin).temporaryPassword;
        assert.notEqual(a, b);
    });

    it('[16] reports an account that does not exist', () => {
        assertRefused(() => t.c.resetUserPassword.resetUserPassword(9999, admin), 404, 'User account not found.');
    });

    it('[16] refuses anyone who is not a User Admin', () => {
        assertRefused(() => t.c.resetUserPassword.resetUserPassword(t.makeUser().id, t.makeUser()), 403);
        assertRefused(() => t.c.resetUserPassword.resetUserPassword(t.makeUser().id, null), 401);
    });
});
