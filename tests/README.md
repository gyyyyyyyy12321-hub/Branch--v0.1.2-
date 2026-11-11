# Tests

Run everything with:

```
npm test
```

No extra packages are needed. The tests use the test runner built into Node (`node:test`) and Node's `assert` module,
and they run against a throw-away in-memory database, so they never touch `data/app.db`.

## How a test is written

```js
it('[7] suspends an Active account', () => {
    const user = t.makeUser();                                     // 1. set up: create an account
    const account = t.c.suspendUserAccount.suspendUserAccount(     // 2. act: call the Control
        user.id, admin);
    assert.equal(account.status, 'Suspended');                     // 3. check: the result is what the story says
});
```

* `t.c` holds every Control (controller) in the real application.
* `t.makeUser({ role, status })` creates an account in any state and returns it (this is the "actor" a request would carry).
* `assertRefused(fn, 403, 'message')` checks that a call is refused with that status and message.
* The number in square brackets in each test name is the user story it checks.

## Sprint 1 (stories 1-27, 33-40, 53-54)

| Stories | What | File |
|---|---|---|
| 1-10, 16 | User Admin account management | `sprint1/admin-accounts.test.js` |
| 11-13 | Admin searches, views and updates profiles | `sprint1/self-service.test.js` |
| 14, 15, 26, 27, 39, 40, 53, 54 | Log in and log out, all four roles | `sprint1/auth.test.js` |
| 17, 33 | Register (designer, customer) | `sprint1/self-service.test.js` |
| 18, 20-23 and 34-38 | View, update, delete, deactivate, reactivate own account | `sprint1/self-service.test.js` |
| 19 | Submit company credentials | `sprint1/self-service.test.js` |
| 24, 25 | Designer views and updates own profile | `sprint1/self-service.test.js` |

Run one sprint only: `npm run test:sprint1`.

## Sprint 2 (stories 28-32, 41-52)

| Stories | What | File |
|---|---|---|
| 28, 29, 30 | Designer adds, edits and removes a project (image cleanup, ownership) | `sprint2/projects.test.js` |
| 31, 32 | Portfolio with view counts and shortlist counts | `sprint2/projects.test.js` |
| 41, 42 | Search projects, browse by newest / most viewed / most favourited | `sprint2/browse-favourites-enquiries.test.js` |
| 43 | View a project (view counting, hidden designers) | `sprint2/browse-favourites-enquiries.test.js` |
| 44, 45, 46 | Add, view and remove favourites | `sprint2/browse-favourites-enquiries.test.js` |
| 47 | Send an enquiry (and the designer reading it) | `sprint2/browse-favourites-enquiries.test.js` |
| 48-52 | Categories: create, view, rename, delete, search | `sprint2/categories.test.js` |

Run one sprint only: `npm run test:sprint2`.

## Sprint 3 (stories 55-58)

| Stories | What | File |
|---|---|---|
| 55 | Site visit totals (today, week, month, last 14 days) | `sprint3/platform-management.test.js` |
| 56, 57 | Active vs registered customers and interior design companies | `sprint3/platform-management.test.js` |
| 58 | Daily, weekly and monthly platform report | `sprint3/platform-management.test.js` |

Run one sprint only: `npm run test:sprint3`.
Visits are counted per browser session by middleware, so counting itself is not covered here; the tests insert visits directly.

## What controller tests do not cover

Controller tests check the business rules. These behaviours live outside the controllers and are checked another way:

* Login required and role checks on each route (the middleware), and the session cookie being set or cleared.
* Logging out only returns a message in the Control; clearing the cookie happens in the Boundary.
* Image upload checks (size, type, real file contents) and site-visit counting are middleware.
* Screens and buttons (for example, a guest being sent to the login page) are front-end behaviour.
