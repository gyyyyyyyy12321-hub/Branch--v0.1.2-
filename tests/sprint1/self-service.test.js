'use strict';

// Sprint 1: the account stories a customer or designer does for themselves, plus company credentials.
// The Customer and Interior Designer stories use the same controllers, so each rule is tested for both roles.
//                     Designer  Customer
//   register            17        33
//   view account        18        34
//   update account      20        35
//   delete account      21        36
//   deactivate account  22        37
//   reactivate account  23        38
//   Designer only: 19 (submit company credentials), 24 (view profile), 25 (update profile)
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { buildTestApp, assertRefused, PASSWORD, ROLES, ACCOUNT_STATUS } = require('../helpers/testApp');

let t;
beforeEach(() => { t = buildTestApp(); });

const STORIES = {
    [ROLES.DESIGNER]: { register: 17, view: 18, update: 20, delete: 21, deactivate: 22, reactivate: 23 },
    [ROLES.CUSTOMER]: { register: 33, view: 34, update: 35, delete: 36, deactivate: 37, reactivate: 38 }
};

for (const role of [ROLES.CUSTOMER, ROLES.DESIGNER]) {
    const s = STORIES[role];

    describe(`${role}: register`, () => {
        const signUp = (extra = {}) => t.c.createUserAccount.createUserAccount({
            email: 'self@example.com', password: PASSWORD, name: 'Self Signup', role,
            ...(role === ROLES.DESIGNER ? { registrationNumber: 'REG-1' } : {}), ...extra
        }, null);

        it(`[${s.register}] creates the account${role === ROLES.DESIGNER ? ' as Pending, awaiting admin approval' : ' as Active'}`, () => {
            const account = signUp();
            assert.equal(account.role, role);
            assert.equal(account.status, role === ROLES.DESIGNER ? ACCOUNT_STATUS.PENDING : ACCOUNT_STATUS.ACTIVE);
        });

        it(`[${s.register}] ignores a status chosen by the visitor`, () => {
            const account = signUp({ status: ACCOUNT_STATUS.ACTIVE });
            assert.equal(account.status, role === ROLES.DESIGNER ? ACCOUNT_STATUS.PENDING : ACCOUNT_STATUS.ACTIVE);
        });

        it(`[${s.register}] refuses a duplicate email`, () => {
            signUp();
            assertRefused(() => signUp({ email: 'SELF@example.com' }), 409);
        });

        it(`[${s.register}] refuses an invalid email, a short password and an empty name`, () => {
            assertRefused(() => signUp({ email: 'bad' }), 400);
            assertRefused(() => signUp({ password: 'short' }), 400);
            assertRefused(() => signUp({ name: '' }), 400);
        });

        it(`[${s.register}] cannot be used to sign up as a User Admin or Platform Management`, () => {
            assertRefused(() => signUp({ role: ROLES.USER_ADMIN }), 400);
            assertRefused(() => signUp({ role: ROLES.PLATFORM_MANAGEMENT }), 400);
        });
    });

    describe(`${role}: view, update, deactivate, reactivate and delete their own account`, () => {
        it(`[${s.view}] views their own account`, () => {
            const me = t.makeUser({ role, name: 'Me Myself' });
            const account = t.c.viewUserAccount.viewUserAccount(me.id, me);
            assert.equal(account.email, me.email);
            assert.equal(account.name, 'Me Myself');
        });

        it(`[${s.view}] cannot view someone else's account`, () => {
            const me = t.makeUser({ role }); const other = t.makeUser({ role });
            assertRefused(() => t.c.viewUserAccount.viewUserAccount(other.id, me), 403);
        });

        it(`[${s.update}] changes their own email`, () => {
            const me = t.makeUser({ role });
            assert.equal(t.c.updateUserAccount.updateUserAccount(me.id, { email: 'moved@example.com' }, me).email, 'moved@example.com');
        });

        it(`[${s.update}] changes their own password, which then works for login`, () => {
            const me = t.makeUser({ role });
            t.c.updateUserAccount.updateUserAccount(me.id, { currentPassword: PASSWORD, newPassword: 'AnotherPass789!' }, me);
            assert.ok(t.c.login.login({ email: me.email, password: 'AnotherPass789!' }).token);
        });

        it(`[${s.update}] cannot change someone else's email`, () => {
            const me = t.makeUser({ role }); const other = t.makeUser({ role });
            assertRefused(() => t.c.updateUserAccount.updateUserAccount(other.id, { email: 'hijack@example.com' }, me), 403);
        });

        it(`[${s.deactivate}] deactivates their own account and can then no longer log in`, () => {
            const me = t.makeUser({ role });
            assert.equal(t.c.deactivateUserAccount.deactivateUserAccount(me.id, me).status, ACCOUNT_STATUS.DEACTIVATED);
            assert.throws(() => t.c.login.login({ email: me.email, password: PASSWORD }), e => e.code === 'ACCOUNT_DEACTIVATED');
        });

        it(`[${s.deactivate}] cannot deactivate someone else's account`, () => {
            const me = t.makeUser({ role }); const other = t.makeUser({ role });
            assertRefused(() => t.c.deactivateUserAccount.deactivateUserAccount(other.id, me), 403);
        });

        it(`[${s.reactivate}] reactivates their own deactivated account with email and password`, () => {
            const me = t.makeUser({ role, status: ACCOUNT_STATUS.DEACTIVATED });
            const account = t.c.reactivateUserAccount.reactivateOwnUserAccount({ email: me.email, password: PASSWORD });
            assert.equal(account.status, ACCOUNT_STATUS.ACTIVE);
            assert.ok(t.c.login.login({ email: me.email, password: PASSWORD }).token);
        });

        it(`[${s.reactivate}] refuses the wrong password`, () => {
            const me = t.makeUser({ role, status: ACCOUNT_STATUS.DEACTIVATED });
            assertRefused(() => t.c.reactivateUserAccount.reactivateOwnUserAccount({ email: me.email, password: 'wrong-password' }), 401);
        });

        it(`[${s.reactivate}] leaves a Suspended account for an administrator to reactivate`, () => {
            const me = t.makeUser({ role, status: ACCOUNT_STATUS.SUSPENDED });
            assert.throws(() => t.c.reactivateUserAccount.reactivateOwnUserAccount({ email: me.email, password: PASSWORD }),
                e => e.statusCode === 403 && e.code === 'ACCOUNT_SUSPENDED');
        });

        it(`[${s.reactivate}] refuses an account that is already Active`, () => {
            const me = t.makeUser({ role });
            assertRefused(() => t.c.reactivateUserAccount.reactivateOwnUserAccount({ email: me.email, password: PASSWORD }), 400);
        });

        it(`[${s.delete}] deletes their own account when they confirm with their password`, () => {
            const me = t.makeUser({ role });
            assert.equal(t.c.deleteUserAccount.deleteUserAccount(me.id, me, { password: PASSWORD }).message, 'Account deleted.');
            assert.equal(t.accountOf(me), null);
        });

        it(`[${s.delete}] keeps the account when the password is wrong or missing`, () => {
            const me = t.makeUser({ role });
            assertRefused(() => t.c.deleteUserAccount.deleteUserAccount(me.id, me, { password: 'wrong-password' }), 400, 'Password is incorrect.');
            assertRefused(() => t.c.deleteUserAccount.deleteUserAccount(me.id, me), 400);
            assert.ok(t.accountOf(me));
        });

        it(`[${s.delete}] cannot delete someone else's account`, () => {
            const me = t.makeUser({ role }); const other = t.makeUser({ role });
            assertRefused(() => t.c.deleteUserAccount.deleteUserAccount(other.id, me, { password: PASSWORD }), 403);
            assert.ok(t.accountOf(other));
        });
    });
}

describe('Story 17: a new designer registers with a company registration number', () => {
    const base = { email: 'studio@example.com', password: PASSWORD, name: 'Studio Ltd', role: ROLES.DESIGNER };

    it('[17] requires the registration number', () => {
        assertRefused(() => t.c.createUserAccount.createUserAccount(base, null), 400, /registration number/i);
    });

    it('[17] records the registration number as a Pending credential submission', () => {
        const account = t.c.createUserAccount.createUserAccount({ ...base, registrationNumber: 'REG-77' }, null);
        assert.equal(account.credentialStatus, 'Pending');
        assert.equal(account.registrationNumber, 'REG-77');
    });
});

describe('Story 19: submit company credentials', () => {
    let designer;
    beforeEach(() => { designer = t.makeUser({ role: ROLES.DESIGNER, status: ACCOUNT_STATUS.PENDING }); });
    const submit = (input, actor = designer) => t.c.submitCredentials.submitCredentials(input, actor);

    it('[19] creates a Pending submission for review', () => {
        const credential = submit({ companyName: 'Studio Ltd', registrationNumber: 'REG-1' });
        assert.equal(credential.status, 'Pending');
        assert.equal(credential.company_name ?? credential.companyName, 'Studio Ltd');
    });

    it('[19] replaces the details of a submission that is still Pending instead of adding a second one', () => {
        submit({ companyName: 'Studio Ltd', registrationNumber: 'REG-1' });
        submit({ companyName: 'Studio Ltd (corrected)', registrationNumber: 'REG-2' });
        const latest = t.c.viewCredentials.viewCredentials(designer);
        assert.equal(latest.registration_number ?? latest.registrationNumber, 'REG-2');
        assert.equal(t.app.db.get('SELECT COUNT(*) AS n FROM credentials WHERE user_id = ?', [designer.id]).n, 1);
    });

    it('[19] allows a new submission after a rejection', () => {
        const admin = t.makeUser({ role: ROLES.USER_ADMIN });
        submit({ companyName: 'Studio Ltd', registrationNumber: 'REG-1' });
        t.c.rejectUserAccount.rejectUserAccount(designer.id, admin);
        const again = submit({ companyName: 'Studio Ltd', registrationNumber: 'REG-3' });
        assert.equal(again.status, 'Pending');
    });

    it('[19] refuses a new submission once the credentials are Approved', () => {
        const admin = t.makeUser({ role: ROLES.USER_ADMIN });
        submit({ companyName: 'Studio Ltd', registrationNumber: 'REG-1' });
        t.c.approveUserAccount.approveUserAccount(designer.id, admin);
        assertRefused(() => submit({ companyName: 'Studio Ltd', registrationNumber: 'REG-9' }, t.actorOf(designer)), 400, /already approved/i);
    });

    it('[19] refuses empty fields', () => {
        assertRefused(() => submit({ companyName: '', registrationNumber: 'REG-1' }), 400);
        assertRefused(() => submit({ companyName: 'Studio', registrationNumber: '' }), 400);
    });

    it('[19] refuses anyone who is not an interior designer, or not logged in', () => {
        assertRefused(() => submit({ companyName: 'X', registrationNumber: 'Y' }, t.makeUser()), 403);
        assertRefused(() => submit({ companyName: 'X', registrationNumber: 'Y' }, null), 401);
    });

    it('[19] lets the designer view their latest submission, and only a designer', () => {
        submit({ companyName: 'Studio Ltd', registrationNumber: 'REG-1' });
        assert.equal(t.c.viewCredentials.viewCredentials(designer).status, 'Pending');
        assertRefused(() => t.c.viewCredentials.viewCredentials(t.makeUser()), 403);
    });
});

describe('Stories 24 and 25: a designer views and updates their own profile', () => {
    let designer;
    beforeEach(() => { designer = t.makeUser({ role: ROLES.DESIGNER, name: 'Studio Ltd' }); });

    it('[24] views their own profile', () => {
        assert.equal(t.c.viewUserProfile.viewUserProfile(designer.id, designer).name, 'Studio Ltd');
    });

    it('[24] cannot view another user\'s profile', () => {
        const other = t.makeUser({ role: ROLES.DESIGNER });
        assertRefused(() => t.c.viewUserProfile.viewUserProfile(other.id, designer), 403);
    });

    it('[25] updates the profile details', () => {
        const profile = t.c.updateUserProfile.updateUserProfile(designer.id,
            { name: 'Studio Ltd Singapore', phone: '+65 6123 4567', description: 'Modern interiors', location: 'Singapore', services: 'Design, renovation' }, designer);
        assert.equal(profile.name, 'Studio Ltd Singapore');
        assert.equal(profile.phone, '+65 6123 4567');
        assert.equal(profile.location, 'Singapore');
    });

    it('[25] changes only the fields that were sent', () => {
        t.c.updateUserProfile.updateUserProfile(designer.id, { phone: '12345678' }, designer);
        const profile = t.c.viewUserProfile.viewUserProfile(designer.id, designer);
        assert.equal(profile.name, 'Studio Ltd');
        assert.equal(profile.phone, '12345678');
    });

    it('[25] refuses an empty name, an over-long description, and a request that changes nothing', () => {
        assertRefused(() => t.c.updateUserProfile.updateUserProfile(designer.id, { name: '  ' }, designer), 400);
        assertRefused(() => t.c.updateUserProfile.updateUserProfile(designer.id, { description: 'x'.repeat(1001) }, designer), 400);
        assertRefused(() => t.c.updateUserProfile.updateUserProfile(designer.id, {}, designer), 400, 'Nothing to update.');
    });

    it('[25] cannot update another user\'s profile', () => {
        const other = t.makeUser({ role: ROLES.DESIGNER });
        assertRefused(() => t.c.updateUserProfile.updateUserProfile(other.id, { phone: '1' }, designer), 403);
    });
});

describe('Stories 11, 12 and 13: the User Admin searches, views and updates profiles', () => {
    let admin;
    beforeEach(() => {
        admin = t.makeUser({ role: ROLES.USER_ADMIN });
        t.makeUser({ role: ROLES.DESIGNER, name: 'Nordic Studio' });
        t.makeUser({ role: ROLES.CUSTOMER, name: 'Jamie Lee' });
    });

    it('[11] searches profiles by name', () => {
        const found = t.c.searchUserProfile.searchUserProfiles({ query: 'nordic' }, admin);
        assert.deepEqual(found.map(p => p.name), ['Nordic Studio']);
    });

    it('[11] treats % as ordinary text, and returns an empty list for no match', () => {
        assert.deepEqual(t.c.searchUserProfile.searchUserProfiles({ query: '%' }, admin), []);
        assert.deepEqual(t.c.searchUserProfile.searchUserProfiles({ query: 'zzz-none' }, admin), []);
    });

    it('[11] refuses anyone who is not a User Admin', () => {
        assertRefused(() => t.c.searchUserProfile.searchUserProfiles({}, t.makeUser()), 403);
        assertRefused(() => t.c.searchUserProfile.searchUserProfiles({}, null), 401);
    });

    it('[12] views any user\'s profile', () => {
        const user = t.makeUser({ name: 'Someone Else' });
        assert.equal(t.c.viewUserProfile.viewUserProfile(user.id, admin).name, 'Someone Else');
    });

    it('[12] reports a profile that does not exist', () => {
        assertRefused(() => t.c.viewUserProfile.viewUserProfile(9999, admin), 404, 'User profile not found.');
    });

    it('[13] updates any user\'s profile', () => {
        const user = t.makeUser({ name: 'Old Name' });
        assert.equal(t.c.updateUserProfile.updateUserProfile(user.id, { name: 'New Name' }, admin).name, 'New Name');
    });

    it('[13] reports a profile that does not exist', () => {
        assertRefused(() => t.c.updateUserProfile.updateUserProfile(9999, { name: 'X' }, admin), 404);
    });
});
