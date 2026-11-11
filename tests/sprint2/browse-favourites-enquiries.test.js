'use strict';

// Sprint 2 (step 3) - customer side: stories 41, 42, 43, 44, 45, 46, 47.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { buildTestApp, assertRefused, ROLES, ACCOUNT_STATUS } = require('../helpers/testApp');

describe('Browsing, favourites and enquiries (stories 41-47)', () => {
    let t, designer, customer, living, kitchen;

    const add = (title, extra = {}, owner = designer) => t.c.createProject.createProject({
        title, description: `${title} description`, categoryId: living, status: 'Current', ...extra
    }, owner);
    const titles = list => list.map(p => p.title);
    const setStatus = (user, status) => t.app.db.run('UPDATE users SET status = ? WHERE id = ?', [status, user.id]);
    const setCreated = (id, ts) => t.app.db.run('UPDATE projects SET created_at = ? WHERE id = ?', [ts, id]);

    beforeEach(() => {
        t = buildTestApp();
        designer = t.makeUser({ role: ROLES.DESIGNER, name: 'Dana Designer' });
        customer = t.makeUser({ role: ROLES.CUSTOMER, name: 'Carl Customer', email: 'carl@example.com' });
        living = t.entities.category.create('Living Room');
        kitchen = t.entities.category.create('Kitchen');
    });

    describe('[41] search projects', () => {
        beforeEach(() => {
            add('Scandi Lounge', { description: 'Light wood and wool' });
            add('Compact Galley', { categoryId: kitchen, description: 'Small kitchen' });
        });

        it('[41] no filters lists every visible project', () => {
            assert.equal(t.c.searchProject.searchProjects({}).length, 2);
            assert.equal(t.c.searchProject.searchProjects().length, 2);
        });

        it('[41] matches words in the title, description, category name and designer name', () => {
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ query: 'scandi' })), ['Scandi Lounge']);
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ query: 'wool' })), ['Scandi Lounge']);
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ query: 'kitchen' })), ['Compact Galley']);
            assert.equal(t.c.searchProject.searchProjects({ query: 'dana' }).length, 2);
        });

        it('[41] every word must match', () => {
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ query: 'light wool' })), ['Scandi Lounge']);
            assert.deepEqual(t.c.searchProject.searchProjects({ query: 'light kitchen' }), []);
        });

        it('[41] is not case sensitive and ignores surrounding spaces', () => {
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ query: '  SCANDI  ' })), ['Scandi Lounge']);
        });

        it('[41] a search with no match returns an empty list', () => {
            assert.deepEqual(t.c.searchProject.searchProjects({ query: 'zzz' }), []);
        });

        it('[41] % and _ are searched literally, not as wildcards', () => {
            assert.deepEqual(t.c.searchProject.searchProjects({ query: '%' }), []);
            assert.deepEqual(t.c.searchProject.searchProjects({ query: '_' }), []);
            add('100% Wood');
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ query: '100%' })), ['100% Wood']);
        });

        it('[41] filters by category', () => {
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ categoryId: String(kitchen) })), ['Compact Galley']);
        });

        it('[41] keyword and category combine', () => {
            assert.deepEqual(t.c.searchProject.searchProjects({ query: 'scandi', categoryId: String(kitchen) }), []);
        });

        it('[41] an invalid category id is refused', () => {
            assertRefused(() => t.c.searchProject.searchProjects({ categoryId: 'abc' }), 400, 'Invalid category.');
        });

        it('[41] non-text filters (arrays) are ignored instead of crashing', () => {
            assert.equal(t.c.searchProject.searchProjects({ query: ['a', 'b'], sort: ['views'] }).length, 2);
        });

        it('[41] projects of designers who are not Active are hidden', () => {
            const hidden = t.makeUser({ role: ROLES.DESIGNER });
            add('Hidden Gem', {}, hidden);
            assert.equal(t.c.searchProject.searchProjects({}).length, 3);
            for (const status of [ACCOUNT_STATUS.SUSPENDED, ACCOUNT_STATUS.DEACTIVATED, ACCOUNT_STATUS.PENDING]) {
                setStatus(hidden, status);
                assert.equal(t.c.searchProject.searchProjects({}).length, 2, status);
            }
        });

        it('[41] guests can search', () => {
            assert.equal(t.c.searchProject.searchProjects({}, null).length, 2);
        });
    });

    describe('[42] browse by newest, most viewed, most favourited', () => {
        let a, b, c;
        beforeEach(() => {
            a = add('A'); b = add('B'); c = add('C');
            setCreated(a.id, '2026-10-01 10:00:00');
            setCreated(b.id, '2026-10-03 10:00:00');
            setCreated(c.id, '2026-10-02 10:00:00');
        });

        it('[42] newest is the default', () => {
            assert.deepEqual(titles(t.c.searchProject.searchProjects({})), ['B', 'C', 'A']);
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ sort: 'newest' })), ['B', 'C', 'A']);
        });

        it('[42] most viewed puts the highest view count first', () => {
            t.c.viewProject.viewProject(a.id); t.c.viewProject.viewProject(a.id); t.c.viewProject.viewProject(c.id);
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ sort: 'views' })), ['A', 'C', 'B']);
        });

        it('[42] most favourited puts the most shortlisted first', () => {
            const c2 = t.makeUser({ role: ROLES.CUSTOMER });
            t.c.createFavourite.createFavourite(c.id, customer);
            t.c.createFavourite.createFavourite(c.id, c2);
            t.c.createFavourite.createFavourite(a.id, customer);
            assert.deepEqual(titles(t.c.searchProject.searchProjects({ sort: 'favourites' })), ['C', 'A', 'B']);
        });

        it('[42] an unknown sort order is refused', () => {
            assertRefused(() => t.c.searchProject.searchProjects({ sort: 'random' }), 400, 'Sort order is not valid.');
        });

        it('[42] a customer sees which results they have saved; guests and designers see none', () => {
            t.c.createFavourite.createFavourite(a.id, customer);
            const mine = t.c.searchProject.searchProjects({}, customer);
            assert.deepEqual(mine.filter(p => p.isFavourite).map(p => p.title), ['A']);
            assert.ok(t.c.searchProject.searchProjects({}, null).every(p => p.isFavourite === false));
            assert.ok(t.c.searchProject.searchProjects({}, designer).every(p => p.isFavourite === false));
        });

        it('[42] results include the shortlist count', () => {
            t.c.createFavourite.createFavourite(a.id, customer);
            const found = t.c.searchProject.searchProjects({}).find(p => p.id === a.id);
            assert.equal(found.favouriteCount, 1);
        });
    });

    describe('[43] view a project', () => {
        let project;
        beforeEach(() => { project = add('Showpiece', { year: 2023 }); });

        it('[43] returns the project with its designer\'s details', () => {
            const view = t.c.viewProject.viewProject(project.id, customer);
            assert.equal(view.title, 'Showpiece');
            assert.equal(view.designer, 'Dana Designer');
            assert.equal(view.year, 2023);
            assert.equal(view.category, 'Living Room');
            assert.equal('designerStatus' in view, false);
        });

        it('[43] each opening by a customer or guest counts as one view', () => {
            assert.equal(t.c.viewProject.viewProject(project.id, customer).viewCount, 1);
            assert.equal(t.c.viewProject.viewProject(project.id, null).viewCount, 2);
            assert.equal(t.c.viewProject.viewProject(project.id).viewCount, 3);
        });

        it('[43] the owner does not add a view', () => {
            assert.equal(t.c.viewProject.viewProject(project.id, designer).viewCount, 0);
        });

        it('[43] another designer does add a view', () => {
            const rival = t.makeUser({ role: ROLES.DESIGNER });
            assert.equal(t.c.viewProject.viewProject(project.id, rival).viewCount, 1);
        });

        it('[43] tells a customer whether they saved it', () => {
            assert.equal(t.c.viewProject.viewProject(project.id, customer).isFavourite, false);
            t.c.createFavourite.createFavourite(project.id, customer);
            assert.equal(t.c.viewProject.viewProject(project.id, customer).isFavourite, true);
            assert.equal(t.c.viewProject.viewProject(project.id, null).isFavourite, false);
        });

        it('[43] an unknown project is not found, a bad id is invalid', () => {
            assertRefused(() => t.c.viewProject.viewProject(9999, customer), 404, 'Project not found.');
            assertRefused(() => t.c.viewProject.viewProject('abc', customer), 400, 'Invalid project id.');
        });

        it('[43] a project of a designer who is not Active is hidden from everyone except the owner', () => {
            setStatus(designer, ACCOUNT_STATUS.SUSPENDED);
            assertRefused(() => t.c.viewProject.viewProject(project.id, customer), 404);
            assertRefused(() => t.c.viewProject.viewProject(project.id, null), 404);
            assert.equal(t.c.viewProject.viewProject(project.id, { ...designer, status: ACCOUNT_STATUS.SUSPENDED }).title, 'Showpiece');
            assert.equal(t.entities.project.findById(project.id).view_count, 0);
        });
    });

    describe('[44] add to favourites', () => {
        let project;
        beforeEach(() => { project = add('Fav'); });

        it('[44] saves the project and returns the new count', () => {
            assert.deepEqual(t.c.createFavourite.createFavourite(project.id, customer), { isFavourite: true, favouriteCount: 1 });
            assert.deepEqual(titles(t.c.viewFavourite.viewFavourites(customer)), ['Fav']);
        });

        it('[44] saving twice is harmless', () => {
            t.c.createFavourite.createFavourite(project.id, customer);
            assert.deepEqual(t.c.createFavourite.createFavourite(project.id, customer), { isFavourite: true, favouriteCount: 1 });
            assert.equal(t.c.viewFavourite.viewFavourites(customer).length, 1);
        });

        it('[44] the count includes other customers', () => {
            t.c.createFavourite.createFavourite(project.id, t.makeUser({ role: ROLES.CUSTOMER }));
            assert.equal(t.c.createFavourite.createFavourite(project.id, customer).favouriteCount, 2);
        });

        it('[44] only customers can save favourites', () => {
            assertRefused(() => t.c.createFavourite.createFavourite(project.id, designer), 403, 'Only customers can save favourites.');
            assertRefused(() => t.c.createFavourite.createFavourite(project.id, null), 401);
        });

        it('[44] unknown, invalid and hidden projects cannot be saved', () => {
            assertRefused(() => t.c.createFavourite.createFavourite(9999, customer), 404, 'Project not found.');
            assertRefused(() => t.c.createFavourite.createFavourite('x', customer), 400, 'Invalid project id.');
            setStatus(designer, ACCOUNT_STATUS.SUSPENDED);
            assertRefused(() => t.c.createFavourite.createFavourite(project.id, customer), 404);
        });
    });

    describe('[45] view favourites', () => {
        it('[45] an empty list at first', () => {
            assert.deepEqual(t.c.viewFavourite.viewFavourites(customer), []);
        });

        it('[45] lists saved projects, most recently saved first, each marked as a favourite', () => {
            const a = add('A'), b = add('B'), c = add('C');
            for (const p of [a, b, c]) t.c.createFavourite.createFavourite(p.id, customer);
            t.app.db.run('UPDATE favourites SET created_at = ? WHERE project_id = ?', ['2026-10-01 00:00:00', b.id]);
            t.app.db.run('UPDATE favourites SET created_at = ? WHERE project_id = ?', ['2026-10-02 00:00:00', a.id]);
            t.app.db.run('UPDATE favourites SET created_at = ? WHERE project_id = ?', ['2026-10-03 00:00:00', c.id]);
            const list = t.c.viewFavourite.viewFavourites(customer);
            assert.deepEqual(titles(list), ['C', 'A', 'B']);
            assert.ok(list.every(p => p.isFavourite === true));
        });

        it('[45] only shows the customer\'s own favourites', () => {
            const p = add('Mine');
            t.c.createFavourite.createFavourite(p.id, customer);
            assert.deepEqual(t.c.viewFavourite.viewFavourites(t.makeUser({ role: ROLES.CUSTOMER })), []);
        });

        it('[45] leaves out projects of designers who are not Active, and brings them back on reactivation', () => {
            const p = add('Gone');
            t.c.createFavourite.createFavourite(p.id, customer);
            setStatus(designer, ACCOUNT_STATUS.DEACTIVATED);
            assert.deepEqual(t.c.viewFavourite.viewFavourites(customer), []);
            setStatus(designer, ACCOUNT_STATUS.ACTIVE);
            assert.equal(t.c.viewFavourite.viewFavourites(customer).length, 1);
        });

        it('[45] only customers have a favourites list', () => {
            assertRefused(() => t.c.viewFavourite.viewFavourites(designer), 403, 'Only customers have a favourites list.');
            assertRefused(() => t.c.viewFavourite.viewFavourites(null), 401);
        });
    });

    describe('[46] remove from favourites', () => {
        let project;
        beforeEach(() => { project = add('Fav'); t.c.createFavourite.createFavourite(project.id, customer); });

        it('[46] removes it and returns the new count', () => {
            assert.deepEqual(t.c.deleteFavourite.deleteFavourite(project.id, customer), { isFavourite: false, favouriteCount: 0 });
            assert.deepEqual(t.c.viewFavourite.viewFavourites(customer), []);
        });

        it('[46] removing something not saved is harmless', () => {
            t.c.deleteFavourite.deleteFavourite(project.id, customer);
            assert.deepEqual(t.c.deleteFavourite.deleteFavourite(project.id, customer), { isFavourite: false, favouriteCount: 0 });
        });

        it('[46] only removes this customer\'s save, others keep theirs', () => {
            const other = t.makeUser({ role: ROLES.CUSTOMER });
            t.c.createFavourite.createFavourite(project.id, other);
            assert.equal(t.c.deleteFavourite.deleteFavourite(project.id, customer).favouriteCount, 1);
            assert.equal(t.c.viewFavourite.viewFavourites(other).length, 1);
        });

        it('[46] only customers can remove favourites; the id must be valid', () => {
            assertRefused(() => t.c.deleteFavourite.deleteFavourite(project.id, designer), 403, 'Only customers have a favourites list.');
            assertRefused(() => t.c.deleteFavourite.deleteFavourite('x', customer), 400, 'Invalid project id.');
        });
    });

    describe('[47] send an enquiry', () => {
        let project;
        beforeEach(() => { project = add('Enquire about me'); });

        it('[47] sends the enquiry to the project\'s designer', () => {
            const result = t.c.createEnquiry.createEnquiry({
                projectId: project.id, requirements: 'Redo my kitchen', name: 'Carl C', email: 'carl.c@example.com',
                location: 'Bishan', budget: '$20,000'
            }, customer);
            assert.equal(result.projectId, project.id);
            assert.equal(result.projectTitle, 'Enquire about me');
            assert.equal(result.designer, 'Dana Designer');

            const [enquiry] = t.c.viewEnquiry.viewEnquiries(designer);
            assert.equal(enquiry.name, 'Carl C');
            assert.equal(enquiry.email, 'carl.c@example.com');
            assert.equal(enquiry.location, 'Bishan');
            assert.equal(enquiry.budget, '$20,000');
            assert.equal(enquiry.requirements, 'Redo my kitchen');
            assert.equal(enquiry.projectTitle, 'Enquire about me');
        });

        it('[47] name and email default to the customer\'s own details; location and budget are optional', () => {
            t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi', name: ' ', email: '' }, customer);
            const [enquiry] = t.c.viewEnquiry.viewEnquiries(designer);
            assert.equal(enquiry.name, 'Carl Customer');
            assert.equal(enquiry.email, 'carl@example.com');
            assert.equal(enquiry.location, null);
            assert.equal(enquiry.budget, null);
        });

        it('[47] renovation requirements are required and limited to 2000 characters', () => {
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: '  ' }, customer), 400, 'Renovation requirements is required.');
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'x'.repeat(2001) }, customer), 400, /2000 characters/);
            assert.deepEqual(t.c.viewEnquiry.viewEnquiries(designer), []);
        });

        it('[47] a typed email must be valid', () => {
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi', email: 'nope' }, customer), 400, 'Enter a valid email address.');
        });

        it('[47] optional fields have length limits', () => {
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi', name: 'x'.repeat(101) }, customer), 400, /100 characters/);
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi', location: 'x'.repeat(101) }, customer), 400, /100 characters/);
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi', budget: 'x'.repeat(101) }, customer), 400, /100 characters/);
        });

        it('[47] only customers can send enquiries', () => {
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi' }, designer), 403, 'Only customers can send enquiries.');
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi' }, null), 401);
        });

        it('[47] the project must exist and its designer must be Active', () => {
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: 9999, requirements: 'Hi' }, customer), 404, 'Project not found.');
            assertRefused(() => t.c.createEnquiry.createEnquiry({ requirements: 'Hi' }, customer), 400, 'Invalid project id.');
            setStatus(designer, ACCOUNT_STATUS.SUSPENDED);
            assertRefused(() => t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Hi' }, customer), 404);
        });

        it('[47] a designer only sees enquiries sent to them, newest first', () => {
            const rival = t.makeUser({ role: ROLES.DESIGNER });
            const rivalProject = add('Rival work', {}, rival);
            t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'First' }, customer);
            t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Second' }, customer);
            t.c.createEnquiry.createEnquiry({ projectId: rivalProject.id, requirements: 'For the rival' }, customer);
            t.app.db.run("UPDATE enquiries SET created_at = '2026-10-01 00:00:00' WHERE requirements = 'First'");
            t.app.db.run("UPDATE enquiries SET created_at = '2026-10-02 00:00:00' WHERE requirements = 'Second'");
            assert.deepEqual(t.c.viewEnquiry.viewEnquiries(designer).map(e => e.requirements), ['Second', 'First']);
            assert.deepEqual(t.c.viewEnquiry.viewEnquiries(rival).map(e => e.requirements), ['For the rival']);
        });

        it('[47] only designers can read enquiries', () => {
            assertRefused(() => t.c.viewEnquiry.viewEnquiries(customer), 403, 'Only interior designers receive enquiries.');
        });
    });
});
