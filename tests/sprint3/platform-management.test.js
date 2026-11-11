'use strict';

// Sprint 3 (step 4) - Platform Management dashboard: stories 55, 56, 57, 58.
// The platform timezone is UTC+8 (REPORT_UTC_OFFSET_HOURS, default 8): a local day runs from 16:00 UTC the day before.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { buildTestApp, assertRefused, ROLES, ACCOUNT_STATUS } = require('../helpers/testApp');

describe('Platform Management dashboard (stories 55-58)', () => {
    let t, manager, customer, designer;
    const OTHERS = () => [customer, designer, t.makeUser({ role: ROLES.USER_ADMIN })];

    const visitAt = utc => t.app.db.run('INSERT INTO site_visits (visited_at) VALUES (?)', [utc]);
    const setCreated = (table, id, utc) => t.app.db.run(`UPDATE ${table} SET created_at = ? WHERE id = ?`, [utc, id]);
    const userCreated = (user, utc) => setCreated('users', user.id, utc);
    const nowUtc = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

    beforeEach(() => {
        t = buildTestApp();
        manager = t.makeUser({ role: ROLES.PLATFORM_MANAGEMENT });
        customer = t.makeUser({ role: ROLES.CUSTOMER });
        designer = t.makeUser({ role: ROLES.DESIGNER });
    });

    describe('[55] site visits', () => {
        it('[55] zero visits gives zero totals and 14 zero-filled days', () => {
            const v = t.c.viewSiteVisit.viewSiteVisits(manager);
            assert.equal(v.total, 0);
            assert.equal(v.today, 0);
            assert.equal(v.thisWeek, 0);
            assert.equal(v.thisMonth, 0);
            assert.equal(v.lastDays.length, 14);
            assert.ok(v.lastDays.every(d => d.count === 0));
        });

        it('[55] counts every recorded visit in the total', () => {
            t.entities.siteVisit.record();
            t.entities.siteVisit.record();
            visitAt('2020-01-01 00:00:00');
            assert.equal(t.c.viewSiteVisit.viewSiteVisits(manager).total, 3);
        });

        it('[55] a visit just now counts for today, this week and this month, and appears on the last chart day', () => {
            t.entities.siteVisit.record();
            const v = t.c.viewSiteVisit.viewSiteVisits(manager);
            assert.equal(v.today, 1);
            assert.equal(v.thisWeek, 1);
            assert.equal(v.thisMonth, 1);
            assert.equal(v.lastDays.at(-1).count, 1);
        });

        it('[55] old visits count in the total but not today / this week / this month', () => {
            visitAt('2020-01-01 00:00:00');
            const v = t.c.viewSiteVisit.viewSiteVisits(manager);
            assert.deepEqual([v.total, v.today, v.thisWeek, v.thisMonth], [1, 0, 0, 0]);
        });

        it('[55] the chart days are consecutive, oldest first, ending today', () => {
            const { lastDays } = t.c.viewSiteVisit.viewSiteVisits(manager);
            for (let i = 1; i < lastDays.length; i += 1) {
                assert.equal(Date.parse(lastDays[i].day) - Date.parse(lastDays[i - 1].day), 86400000);
            }
            const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
            assert.equal(lastDays.at(-1).day, today);
        });

        it('[55] only Platform Management can view site visits', () => {
            for (const user of OTHERS()) {
                assertRefused(() => t.c.viewSiteVisit.viewSiteVisits(user), 403, 'Only Platform Management can view site visits.');
            }
            assertRefused(() => t.c.viewSiteVisit.viewSiteVisits(null), 401);
        });
    });

    describe('[56] active customers', () => {
        it('[56] counts Active customers against all registered customers', () => {
            t.makeUser({ role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.SUSPENDED });
            t.makeUser({ role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.DEACTIVATED });
            t.makeUser({ role: ROLES.CUSTOMER });
            // setup has 1 Active customer, plus 1 more Active, 1 Suspended, 1 Deactivated
            assert.deepEqual(t.c.viewActiveCustomer.viewActiveCustomers(manager), { active: 2, registered: 4 });
        });

        it('[56] ignores designers and other roles', () => {
            assert.deepEqual(t.c.viewActiveCustomer.viewActiveCustomers(manager), { active: 1, registered: 1 });
        });

        it('[56] follows a status change', () => {
            t.app.db.run('UPDATE users SET status = ? WHERE id = ?', [ACCOUNT_STATUS.SUSPENDED, customer.id]);
            assert.deepEqual(t.c.viewActiveCustomer.viewActiveCustomers(manager), { active: 0, registered: 1 });
        });

        it('[56] only Platform Management can view it', () => {
            for (const user of OTHERS()) {
                assertRefused(() => t.c.viewActiveCustomer.viewActiveCustomers(user), 403, 'Only Platform Management can view this.');
            }
            assertRefused(() => t.c.viewActiveCustomer.viewActiveCustomers(null), 401);
        });
    });

    describe('[57] active interior design companies', () => {
        it('[57] counts Active designers against all registered designers', () => {
            t.makeUser({ role: ROLES.DESIGNER, status: ACCOUNT_STATUS.PENDING });
            t.makeUser({ role: ROLES.DESIGNER, status: ACCOUNT_STATUS.SUSPENDED });
            assert.deepEqual(t.c.viewActiveDesigner.viewActiveDesigners(manager), { active: 1, registered: 3 });
        });

        it('[57] ignores customers and other roles', () => {
            assert.deepEqual(t.c.viewActiveDesigner.viewActiveDesigners(manager), { active: 1, registered: 1 });
        });

        it('[57] only Platform Management can view it', () => {
            for (const user of OTHERS()) {
                assertRefused(() => t.c.viewActiveDesigner.viewActiveDesigners(user), 403, 'Only Platform Management can view this.');
            }
            assertRefused(() => t.c.viewActiveDesigner.viewActiveDesigners(null), 401);
        });
    });

    describe('[58] platform report', () => {
        const report = (input, actor = manager) => t.c.createReport.createReport(input, actor);

        it('[58] a daily report covers one local day', () => {
            const r = report({ period: 'daily', date: '2026-10-15' });
            assert.equal(r.period, 'daily');
            assert.equal(r.from, '2026-10-15');
            assert.equal(r.to, '2026-10-15');
            assert.deepEqual(r.dailyActivity.map(d => d.day), ['2026-10-15']);
        });

        it('[58] a weekly report runs Monday to Sunday around the chosen date', () => {
            const r = report({ period: 'weekly', date: '2026-10-15' }); // a Thursday
            assert.equal(r.from, '2026-10-12');
            assert.equal(r.to, '2026-10-18');
            assert.equal(r.dailyActivity.length, 7);
            const sunday = report({ period: 'weekly', date: '2026-10-18' });
            assert.equal(sunday.from, '2026-10-12');
        });

        it('[58] a monthly report covers the whole calendar month', () => {
            const r = report({ period: 'monthly', date: '2026-10-15' });
            assert.equal(r.from, '2026-10-01');
            assert.equal(r.to, '2026-10-31');
            assert.equal(r.dailyActivity.length, 31);
            assert.equal(report({ period: 'monthly', date: '2026-02-10' }).dailyActivity.length, 28);
        });

        it('[58] without a date the report is for today', () => {
            const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
            assert.equal(report({ period: 'daily' }).from, today);
        });

        it('[58] includes a generation time', () => {
            assert.ok(!Number.isNaN(Date.parse(report({ period: 'daily' }).generatedAt)));
        });

        it('[58] counts site visits inside the period only, using the platform timezone', () => {
            visitAt('2026-10-14 16:00:00'); // 00:00 on 15 Oct local: first moment of the day
            visitAt('2026-10-15 15:59:59'); // 23:59:59 on 15 Oct local: last moment
            visitAt('2026-10-14 15:59:59'); // 14 Oct local
            visitAt('2026-10-15 16:00:00'); // 16 Oct local
            const r = report({ period: 'daily', date: '2026-10-15' });
            assert.equal(r.activity.siteVisits, 2);
            assert.equal(r.dailyActivity[0].siteVisits, 2);
        });

        it('[58] visits by day are zero-filled for days without visits', () => {
            visitAt('2026-10-13 04:00:00'); // 13 Oct local
            visitAt('2026-10-13 05:00:00');
            visitAt('2026-10-17 04:00:00'); // 17 Oct local
            const r = report({ period: 'weekly', date: '2026-10-15' });
            assert.deepEqual(r.dailyActivity.map(d => d.siteVisits), [0, 2, 0, 0, 0, 1, 0]);
            assert.equal(r.activity.siteVisits, 3);
        });

        it('[58] counts new customers, new designers, projects, favourites and enquiries in the period', () => {
            const category = t.entities.category.create('Living Room');
            const project = t.c.createProject.createProject({ title: 'P', description: 'd', categoryId: category }, designer);
            t.c.createFavourite.createFavourite(project.id, customer);
            t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi' }, customer);

            userCreated(customer, '2026-10-15 02:00:00');
            userCreated(designer, '2026-10-15 03:00:00');
            setCreated('projects', project.id, '2026-10-15 04:00:00');
            t.app.db.run('UPDATE favourites SET created_at = ?', ['2026-10-15 05:00:00']);
            t.app.db.run('UPDATE enquiries SET created_at = ?', ['2026-10-15 06:00:00']);

            const inside = report({ period: 'daily', date: '2026-10-15' }).activity;
            assert.deepEqual(inside, {
                siteVisits: 0, newCustomers: 1, newDesigners: 1, newProjects: 1, favouritesAdded: 1, enquiriesSent: 1
            });
            const elsewhere = report({ period: 'daily', date: '2026-10-20' }).activity;
            assert.deepEqual(elsewhere, {
                siteVisits: 0, newCustomers: 0, newDesigners: 0, newProjects: 0, favouritesAdded: 0, enquiriesSent: 0
            });
        });

        it('[58] activity is only counted for its own role (a new customer is not a new designer)', () => {
            userCreated(customer, '2026-10-15 02:00:00');
            userCreated(designer, '2026-09-01 02:00:00');
            const a = report({ period: 'daily', date: '2026-10-15' }).activity;
            assert.equal(a.newCustomers, 1);
            assert.equal(a.newDesigners, 0);
        });

        it('[58] every day of the period has an entry for every statistic, zero when nothing happened', () => {
            const r = report({ period: 'weekly', date: '2026-10-15' });
            assert.equal(r.dailyActivity.length, 7);
            for (const day of r.dailyActivity) {
                assert.deepEqual(Object.keys(day),
                    ['day', 'siteVisits', 'newCustomers', 'newDesigners', 'newProjects', 'favouritesAdded', 'enquiriesSent']);
                assert.ok(Object.values(day).slice(1).every(n => n === 0));
            }
        });

        it('[58] breaks each statistic down per day (platform timezone) and the days add up to the period totals', () => {
            const category = t.entities.category.create('Living Room');
            const customer2 = t.makeUser({ role: ROLES.CUSTOMER });
            const designer2 = t.makeUser({ role: ROLES.DESIGNER });
            const p1 = t.c.createProject.createProject({ title: 'A', description: 'd', categoryId: category }, designer);
            const p2 = t.c.createProject.createProject({ title: 'B', description: 'd', categoryId: category }, designer);
            t.c.createFavourite.createFavourite(p1.id, customer);
            t.c.createFavourite.createFavourite(p2.id, customer);
            t.c.createFavourite.createFavourite(p2.id, customer2);
            t.c.createEnquiry.createEnquiry({ projectId: p1.id, requirements: 'One' }, customer);
            t.c.createEnquiry.createEnquiry({ projectId: p2.id, requirements: 'Two' }, customer2);

            userCreated(customer, '2026-10-13 04:00:00');         // Tue 13 Oct local
            userCreated(customer2, '2026-10-14 17:00:00');        // 15 Oct 01:00 local: Thursday, not Wednesday
            userCreated(designer, '2026-10-13 05:00:00');
            userCreated(designer2, '2026-10-17 04:00:00');
            setCreated('projects', p1.id, '2026-10-12 20:00:00'); // 13 Oct 04:00 local
            setCreated('projects', p2.id, '2026-10-18 03:00:00'); // Sun 18 Oct local
            t.app.db.run("UPDATE favourites SET created_at = '2026-10-15 04:00:00' WHERE project_id = ?", [p1.id]);
            t.app.db.run("UPDATE favourites SET created_at = '2026-10-15 05:00:00' WHERE project_id = ? AND customer_id = ?", [p2.id, customer.id]);
            t.app.db.run("UPDATE favourites SET created_at = '2026-10-16 04:00:00' WHERE project_id = ? AND customer_id = ?", [p2.id, customer2.id]);
            t.app.db.run("UPDATE enquiries SET created_at = '2026-10-14 04:00:00' WHERE requirements = 'One'");
            t.app.db.run("UPDATE enquiries SET created_at = '2026-10-14 05:00:00' WHERE requirements = 'Two'");

            const r = report({ period: 'weekly', date: '2026-10-15' });                  // Mon 12 .. Sun 18 Oct
            const series = key => r.dailyActivity.map(d => d[key]);
            assert.deepEqual(series('newCustomers'), [0, 1, 0, 1, 0, 0, 0]);
            assert.deepEqual(series('newDesigners'), [0, 1, 0, 0, 0, 1, 0]);
            assert.deepEqual(series('newProjects'), [0, 1, 0, 0, 0, 0, 1]);
            assert.deepEqual(series('favouritesAdded'), [0, 0, 0, 2, 1, 0, 0]);
            assert.deepEqual(series('enquiriesSent'), [0, 0, 2, 0, 0, 0, 0]);
            for (const key of ['newCustomers', 'newDesigners', 'newProjects', 'favouritesAdded', 'enquiriesSent']) {
                assert.equal(series(key).reduce((a, b) => a + b, 0), r.activity[key], key);
            }
        });

        it('[58] the daily breakdown only counts users of the matching role', () => {
            userCreated(customer, '2026-10-15 04:00:00');
            userCreated(designer, '2026-10-15 04:00:00');
            const [day] = report({ period: 'daily', date: '2026-10-15' }).dailyActivity;
            assert.equal(day.newCustomers, 1);
            assert.equal(day.newDesigners, 1);
        });


        it('[58] platform totals are current, whatever the period', () => {
            t.makeUser({ role: ROLES.CUSTOMER, status: ACCOUNT_STATUS.SUSPENDED });
            const category = t.entities.category.create('Living Room');
            t.c.createProject.createProject({ title: 'P', description: 'd', categoryId: category }, designer);
            const r = report({ period: 'daily', date: '2020-01-01' });
            assert.deepEqual(r.platform, { activeCustomers: 1, activeDesigners: 1, totalProjects: 1 });
        });

        it('[58] the period must be daily, weekly or monthly', () => {
            for (const period of [undefined, '', 'yearly', 'Daily']) {
                assertRefused(() => report({ period }), 400, 'Choose daily, weekly or monthly.');
            }
            assertRefused(() => t.c.createReport.createReport(undefined, manager), 400, 'Choose daily, weekly or monthly.');
        });

        it('[58] the date must be a real calendar date', () => {
            for (const date of ['2026-02-30', '2026-13-01', 'yesterday', '15-10-2026', '2026-1-5']) {
                assertRefused(() => report({ period: 'daily', date }), 400, 'Enter a valid date.');
            }
        });

        it('[58] only Platform Management can generate reports', () => {
            for (const user of OTHERS()) {
                assertRefused(() => report({ period: 'daily' }, user), 403, 'Only Platform Management can generate reports.');
            }
            assertRefused(() => report({ period: 'daily' }, null), 401);
        });
    });
});
