'use strict';

// Sprint 2 (step 3) - designer projects: stories 28, 29, 30, 31, 32.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildTestApp, assertRefused, ROLES, ACCOUNT_STATUS } = require('../helpers/testApp');

/** Saves a fake uploaded image the way the upload middleware would, and returns its public path. */
function saveImage(t, name) {
    fs.writeFileSync(path.join(t.app.imageStorage.uploadDir, name), 'x');
    return `/uploads/${name}`;
}
const imageExists = (t, publicPath) => fs.existsSync(path.join(t.app.imageStorage.uploadDir, path.basename(publicPath)));

describe('Projects (stories 28-32)', () => {
    let t, designer, other, customer, category, category2;
    const valid = () => ({ title: 'Modern Loft', description: 'Open plan loft', categoryId: category, status: 'Current', year: 2024 });

    beforeEach(() => {
        t = buildTestApp();
        designer = t.makeUser({ role: ROLES.DESIGNER, name: 'Dana Designer' });
        other = t.makeUser({ role: ROLES.DESIGNER });
        customer = t.makeUser({ role: ROLES.CUSTOMER });
        category = t.entities.category.create('Living Room');
        category2 = t.entities.category.create('Kitchen');
    });

    describe('[28] create a project', () => {
        it('[28] saves the project under the logged-in designer and returns its details', () => {
            const project = t.c.createProject.createProject(valid(), designer);
            assert.equal(project.title, 'Modern Loft');
            assert.equal(project.designerId, designer.id);
            assert.equal(project.category, 'Living Room');
            assert.equal(project.year, 2024);
            assert.equal(project.viewCount, 0);
            assert.equal(project.favouriteCount, 0);
        });

        it('[28] status defaults to Current and year is optional', () => {
            const { year, status, ...rest } = valid();
            const project = t.c.createProject.createProject(rest, designer);
            assert.equal(project.status, 'Current');
            assert.equal(project.year, null);
        });

        it('[28] keeps the uploaded image path', () => {
            const img = saveImage(t, 'a.jpg');
            const project = t.c.createProject.createProject(valid(), designer, img);
            assert.equal(project.imagePath, img);
            assert.ok(imageExists(t, img));
        });

        it('[28] trims the title and description', () => {
            const project = t.c.createProject.createProject({ ...valid(), title: '  Loft  ', description: '  Nice  ' }, designer);
            assert.equal(project.title, 'Loft');
            assert.equal(project.description, 'Nice');
        });

        it('[28] only an interior designer can add projects', () => {
            assertRefused(() => t.c.createProject.createProject(valid(), customer), 403, 'Only interior designers can add projects.');
            assertRefused(() => t.c.createProject.createProject(valid(), null), 401);
        });

        it('[28] title and description are required', () => {
            assertRefused(() => t.c.createProject.createProject({ ...valid(), title: '  ' }, designer), 400, 'Title is required.');
            assertRefused(() => t.c.createProject.createProject({ ...valid(), description: '' }, designer), 400, 'Description is required.');
        });

        it('[28] title is limited to 120 characters and description to 2000', () => {
            assertRefused(() => t.c.createProject.createProject({ ...valid(), title: 'x'.repeat(121) }, designer), 400, /120 characters/);
            assertRefused(() => t.c.createProject.createProject({ ...valid(), description: 'x'.repeat(2001) }, designer), 400, /2000 characters/);
            t.c.createProject.createProject({ ...valid(), title: 'x'.repeat(120) }, designer);
        });

        it('[28] the category must exist', () => {
            assertRefused(() => t.c.createProject.createProject({ ...valid(), categoryId: 9999 }, designer), 400, 'Choose a valid category.');
            assertRefused(() => t.c.createProject.createProject({ ...valid(), categoryId: undefined }, designer), 400, 'Choose a valid category.');
            assertRefused(() => t.c.createProject.createProject({ ...valid(), categoryId: 'abc' }, designer), 400, 'Choose a valid category.');
        });

        it('[28] status must be Current or Past', () => {
            assertRefused(() => t.c.createProject.createProject({ ...valid(), status: 'Draft' }, designer), 400, 'Project status is not valid.');
            const past = t.c.createProject.createProject({ ...valid(), status: 'Past' }, designer);
            assert.equal(past.status, 'Past');
        });

        it('[28] year must be a whole number from 1900 to 2100', () => {
            for (const year of [1899, 2101, 'abc', 2020.5]) {
                assertRefused(() => t.c.createProject.createProject({ ...valid(), year }, designer), 400, 'Year must be between 1900 and 2100.');
            }
            assert.equal(t.c.createProject.createProject({ ...valid(), year: 1900 }, designer).year, 1900);
            assert.equal(t.c.createProject.createProject({ ...valid(), year: '' }, designer).year, null);
        });

        it('[28] a rejected project is not saved and its uploaded image is deleted', () => {
            const img = saveImage(t, 'orphan.jpg');
            assertRefused(() => t.c.createProject.createProject({ ...valid(), title: '' }, designer, img), 400);
            assert.equal(t.c.viewPortfolio.viewPortfolio(designer).projects.length, 0);
            assert.equal(imageExists(t, img), false);
        });

        it('[28] an image uploaded by someone who is not a designer is also deleted', () => {
            const img = saveImage(t, 'orphan2.jpg');
            assertRefused(() => t.c.createProject.createProject(valid(), customer, img), 403);
            assert.equal(imageExists(t, img), false);
        });
    });

    describe('[29] edit a project', () => {
        let project;
        beforeEach(() => { project = t.c.createProject.createProject(valid(), designer, saveImage(t, 'old.jpg')); });

        it('[29] changes only the fields that were sent', () => {
            const updated = t.c.updateProject.updateProject(project.id, { title: 'New Title' }, designer);
            assert.equal(updated.title, 'New Title');
            assert.equal(updated.description, 'Open plan loft');
            assert.equal(updated.category, 'Living Room');
            assert.equal(updated.year, 2024);
            assert.equal(updated.imagePath, project.imagePath);
        });

        it('[29] can change category, status and year', () => {
            const updated = t.c.updateProject.updateProject(project.id, { categoryId: category2, status: 'Past', year: 2019 }, designer);
            assert.equal(updated.category, 'Kitchen');
            assert.equal(updated.status, 'Past');
            assert.equal(updated.year, 2019);
        });

        it('[29] an empty year clears it', () => {
            assert.equal(t.c.updateProject.updateProject(project.id, { year: '' }, designer).year, null);
        });

        it('[29] a new image replaces the old one and the old file is deleted', () => {
            const fresh = saveImage(t, 'new.jpg');
            const updated = t.c.updateProject.updateProject(project.id, {}, designer, fresh);
            assert.equal(updated.imagePath, fresh);
            assert.equal(imageExists(t, project.imagePath), false);
            assert.ok(imageExists(t, fresh));
        });

        it('[29] removeImage clears the image and deletes the file', () => {
            for (const flag of [true, 'true']) {
                const p = t.c.createProject.createProject(valid(), designer, saveImage(t, `r${flag}.jpg`));
                const updated = t.c.updateProject.updateProject(p.id, { removeImage: flag }, designer);
                assert.equal(updated.imagePath, null);
                assert.equal(imageExists(t, p.imagePath), false);
            }
        });

        it('[29] a designer cannot edit another designer\'s project', () => {
            assertRefused(() => t.c.updateProject.updateProject(project.id, { title: 'Hijack' }, other), 403, 'You can only change your own projects.');
            assert.equal(t.c.viewProject.viewProject(project.id, designer).title, 'Modern Loft');
        });

        it('[29] customers cannot edit projects', () => {
            assertRefused(() => t.c.updateProject.updateProject(project.id, { title: 'X' }, customer), 403, 'Only interior designers can edit projects.');
        });

        it('[29] an unknown project is not found', () => {
            assertRefused(() => t.c.updateProject.updateProject(9999, { title: 'X' }, designer), 404, 'Project not found.');
            assertRefused(() => t.c.updateProject.updateProject('abc', { title: 'X' }, designer), 400, 'Invalid project id.');
        });

        it('[29] sending nothing is refused', () => {
            assertRefused(() => t.c.updateProject.updateProject(project.id, {}, designer), 400, 'Nothing to update.');
        });

        it('[29] invalid values are refused and the project stays unchanged', () => {
            assertRefused(() => t.c.updateProject.updateProject(project.id, { title: '' }, designer), 400, 'Title is required.');
            assertRefused(() => t.c.updateProject.updateProject(project.id, { categoryId: 9999 }, designer), 400, 'Choose a valid category.');
            assert.equal(t.c.viewProject.viewProject(project.id, designer).title, 'Modern Loft');
        });

        it('[29] a failed update deletes the newly uploaded file and keeps the old one', () => {
            const fresh = saveImage(t, 'fresh.jpg');
            assertRefused(() => t.c.updateProject.updateProject(project.id, { title: '' }, designer, fresh), 400);
            assert.equal(imageExists(t, fresh), false);
            assert.ok(imageExists(t, project.imagePath));
        });

        it('[29] an upload to someone else\'s project is deleted too', () => {
            const fresh = saveImage(t, 'fresh2.jpg');
            assertRefused(() => t.c.updateProject.updateProject(project.id, { title: 'X' }, other, fresh), 403);
            assert.equal(imageExists(t, fresh), false);
        });
    });

    describe('[30] remove a project', () => {
        let project;
        beforeEach(() => { project = t.c.createProject.createProject(valid(), designer, saveImage(t, 'del.jpg')); });

        it('[30] removes the project and its image file', () => {
            assert.deepEqual(t.c.deleteProject.deleteProject(project.id, designer), { message: 'Project removed.' });
            assertRefused(() => t.c.viewProject.viewProject(project.id, designer), 404);
            assert.equal(imageExists(t, project.imagePath), false);
        });

        it('[30] only the owner can remove it', () => {
            assertRefused(() => t.c.deleteProject.deleteProject(project.id, other), 403, 'You can only remove your own projects.');
            assertRefused(() => t.c.deleteProject.deleteProject(project.id, customer), 403, 'Only interior designers can remove projects.');
            assert.ok(imageExists(t, project.imagePath));
            assert.equal(t.c.viewPortfolio.viewPortfolio(designer).projects.length, 1);
        });

        it('[30] an unknown project is not found, a bad id is invalid', () => {
            assertRefused(() => t.c.deleteProject.deleteProject(9999, designer), 404, 'Project not found.');
            assertRefused(() => t.c.deleteProject.deleteProject('x', designer), 400, 'Invalid project id.');
        });

        it('[30] removing it twice is refused the second time', () => {
            t.c.deleteProject.deleteProject(project.id, designer);
            assertRefused(() => t.c.deleteProject.deleteProject(project.id, designer), 404);
        });

        it('[30] favourites of the project go with it', () => {
            t.c.createFavourite.createFavourite(project.id, customer);
            t.c.deleteProject.deleteProject(project.id, designer);
            assert.deepEqual(t.c.viewFavourite.viewFavourites(customer), []);
        });

        it('[30] enquiries about the project keep their text but lose the link', () => {
            t.c.createEnquiry.createEnquiry({ projectId: project.id, requirements: 'Paint the walls' }, customer);
            t.c.deleteProject.deleteProject(project.id, designer);
            const [enquiry] = t.c.viewEnquiry.viewEnquiries(designer);
            assert.equal(enquiry.requirements, 'Paint the walls');
            assert.equal(enquiry.projectId, null);
            assert.equal(enquiry.projectTitle, null);
        });
    });

    describe('[31][32] portfolio, views and shortlists', () => {
        it('[31][32] an empty portfolio has zero totals and no most viewed project', () => {
            const { projects, totals } = t.c.viewPortfolio.viewPortfolio(designer);
            assert.deepEqual(projects, []);
            assert.deepEqual(totals, { projects: 0, views: 0, shortlists: 0, mostViewed: null });
        });

        it('[31] shows each project\'s view count and the total', () => {
            const a = t.c.createProject.createProject({ ...valid(), title: 'A' }, designer);
            const b = t.c.createProject.createProject({ ...valid(), title: 'B' }, designer);
            t.c.viewProject.viewProject(a.id, customer);
            t.c.viewProject.viewProject(b.id, customer);
            t.c.viewProject.viewProject(b.id, null);
            const { projects, totals } = t.c.viewPortfolio.viewPortfolio(designer);
            assert.equal(projects.find(p => p.id === a.id).viewCount, 1);
            assert.equal(projects.find(p => p.id === b.id).viewCount, 2);
            assert.equal(totals.views, 3);
            assert.equal(totals.projects, 2);
            assert.deepEqual(totals.mostViewed, { id: b.id, title: 'B', viewCount: 2 });
        });

        it('[32] shows how many customers shortlisted each project and the total', () => {
            const a = t.c.createProject.createProject({ ...valid(), title: 'A' }, designer);
            const b = t.c.createProject.createProject({ ...valid(), title: 'B' }, designer);
            const c2 = t.makeUser({ role: ROLES.CUSTOMER });
            t.c.createFavourite.createFavourite(a.id, customer);
            t.c.createFavourite.createFavourite(a.id, c2);
            t.c.createFavourite.createFavourite(b.id, customer);
            const { projects, totals } = t.c.viewPortfolio.viewPortfolio(designer);
            assert.equal(projects.find(p => p.id === a.id).favouriteCount, 2);
            assert.equal(projects.find(p => p.id === b.id).favouriteCount, 1);
            assert.equal(totals.shortlists, 3);
        });

        it('[31] the owner opening their own project does not add a view', () => {
            const p = t.c.createProject.createProject(valid(), designer);
            t.c.viewProject.viewProject(p.id, designer);
            assert.equal(t.c.viewPortfolio.viewPortfolio(designer).totals.views, 0);
        });

        it('[31][32] only lists the designer\'s own projects, newest first', () => {
            const a = t.c.createProject.createProject({ ...valid(), title: 'A' }, designer);
            const b = t.c.createProject.createProject({ ...valid(), title: 'B' }, designer);
            t.c.createProject.createProject({ ...valid(), title: 'Not mine' }, other);
            t.app.db.run('UPDATE projects SET created_at = ? WHERE id = ?', ['2026-10-01 00:00:00', a.id]);
            t.app.db.run('UPDATE projects SET created_at = ? WHERE id = ?', ['2026-10-02 00:00:00', b.id]);
            const titles = t.c.viewPortfolio.viewPortfolio(designer).projects.map(p => p.title);
            assert.deepEqual(titles, ['B', 'A']);
        });

        it('[31][32] a suspended designer still sees their own portfolio', () => {
            t.c.createProject.createProject(valid(), designer);
            t.app.db.run('UPDATE users SET status = ? WHERE id = ?', [ACCOUNT_STATUS.SUSPENDED, designer.id]);
            assert.equal(t.c.viewPortfolio.viewPortfolio(designer).projects.length, 1);
        });

        it('[31][32] only designers have a portfolio', () => {
            assertRefused(() => t.c.viewPortfolio.viewPortfolio(customer), 403, 'Only interior designers have a portfolio.');
            assertRefused(() => t.c.viewPortfolio.viewPortfolio(null), 401);
        });
    });
});
