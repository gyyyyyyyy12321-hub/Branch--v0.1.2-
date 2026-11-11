'use strict';

// Sprint 2 (step 3) - project categories: stories 48, 49, 50, 51, 52.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { buildTestApp, assertRefused, ROLES } = require('../helpers/testApp');

describe('Project categories (stories 48-52)', () => {
    let t, manager, customer, designer;
    const names = list => list.map(c => c.name);

    beforeEach(() => {
        t = buildTestApp();
        manager = t.makeUser({ role: ROLES.PLATFORM_MANAGEMENT });
        customer = t.makeUser({ role: ROLES.CUSTOMER });
        designer = t.makeUser({ role: ROLES.DESIGNER });
    });

    const useCategory = (id, n = 1) => {
        for (let i = 0; i < n; i += 1) {
            t.c.createProject.createProject({ title: `P${i}`, description: 'd', categoryId: id }, designer);
        }
    };

    describe('[48] create a category', () => {
        it('[48] adds a category with zero projects', () => {
            const created = t.c.createProjectCategory.createProjectCategory({ name: 'Bathroom' }, manager);
            assert.equal(created.name, 'Bathroom');
            assert.equal(created.projectCount, 0);
            assert.deepEqual(names(t.c.viewProjectCategory.viewProjectCategories()), ['Bathroom']);
        });

        it('[48] trims the name', () => {
            assert.equal(t.c.createProjectCategory.createProjectCategory({ name: '  Bathroom  ' }, manager).name, 'Bathroom');
        });

        it('[48] the name is required and limited to 50 characters', () => {
            assertRefused(() => t.c.createProjectCategory.createProjectCategory({ name: ' ' }, manager), 400, 'Category name is required.');
            assertRefused(() => t.c.createProjectCategory.createProjectCategory({}, manager), 400, 'Category name is required.');
            assertRefused(() => t.c.createProjectCategory.createProjectCategory({ name: 'x'.repeat(51) }, manager), 400, /50 characters/);
            t.c.createProjectCategory.createProjectCategory({ name: 'x'.repeat(50) }, manager);
        });

        it('[48] a duplicate name is refused, whatever the letter case', () => {
            t.c.createProjectCategory.createProjectCategory({ name: 'Bathroom' }, manager);
            assertRefused(() => t.c.createProjectCategory.createProjectCategory({ name: 'Bathroom' }, manager), 409, 'A category with this name already exists.');
            assertRefused(() => t.c.createProjectCategory.createProjectCategory({ name: 'BATHROOM' }, manager), 409);
            assert.equal(t.c.viewProjectCategory.viewProjectCategories().length, 1);
        });

        it('[48] only Platform Management can add categories', () => {
            for (const user of [customer, designer, t.makeUser({ role: ROLES.USER_ADMIN })]) {
                assertRefused(() => t.c.createProjectCategory.createProjectCategory({ name: 'X' }, user), 403, 'Only Platform Management can manage categories.');
            }
            assertRefused(() => t.c.createProjectCategory.createProjectCategory({ name: 'X' }, null), 401);
        });
    });

    describe('[49] view categories', () => {
        it('[49] lists categories alphabetically with their project counts', () => {
            const b = t.entities.category.create('Bedroom');
            t.entities.category.create('Attic');
            useCategory(b, 2);
            const list = t.c.viewProjectCategory.viewProjectCategories();
            assert.deepEqual(list.map(c => [c.name, c.projectCount]), [['Attic', 0], ['Bedroom', 2]]);
        });

        it('[49] is empty when there are no categories', () => {
            assert.deepEqual(t.c.viewProjectCategory.viewProjectCategories(), []);
        });

        it('[49] needs no login', () => {
            t.entities.category.create('Attic');
            assert.equal(t.c.viewProjectCategory.viewProjectCategories().length, 1);
        });
    });

    describe('[50] rename a category', () => {
        let id;
        beforeEach(() => { id = t.entities.category.create('Livin Room'); });

        it('[50] renames it and keeps its projects', () => {
            useCategory(id, 2);
            const updated = t.c.updateProjectCategory.updateProjectCategory(id, { name: 'Living Room' }, manager);
            assert.deepEqual(updated, { id, name: 'Living Room', projectCount: 2 });
            const [project] = t.c.searchProject.searchProjects({});
            assert.equal(project.category, 'Living Room');
        });

        it('[50] keeping the same name (or only changing its case) is allowed', () => {
            assert.equal(t.c.updateProjectCategory.updateProjectCategory(id, { name: 'Livin Room' }, manager).name, 'Livin Room');
            assert.equal(t.c.updateProjectCategory.updateProjectCategory(id, { name: 'LIVIN ROOM' }, manager).name, 'LIVIN ROOM');
        });

        it('[50] cannot take another category\'s name', () => {
            t.entities.category.create('Kitchen');
            assertRefused(() => t.c.updateProjectCategory.updateProjectCategory(id, { name: 'kitchen' }, manager), 409, 'A category with this name already exists.');
            assert.deepEqual(names(t.c.viewProjectCategory.viewProjectCategories()), ['Kitchen', 'Livin Room']);
        });

        it('[50] the new name is required and limited to 50 characters', () => {
            assertRefused(() => t.c.updateProjectCategory.updateProjectCategory(id, { name: '' }, manager), 400, 'Category name is required.');
            assertRefused(() => t.c.updateProjectCategory.updateProjectCategory(id, { name: 'x'.repeat(51) }, manager), 400, /50 characters/);
        });

        it('[50] an unknown category is not found, a bad id is invalid', () => {
            assertRefused(() => t.c.updateProjectCategory.updateProjectCategory(9999, { name: 'X' }, manager), 404, 'Category not found.');
            assertRefused(() => t.c.updateProjectCategory.updateProjectCategory('abc', { name: 'X' }, manager), 400, 'Invalid category id.');
        });

        it('[50] only Platform Management can rename', () => {
            assertRefused(() => t.c.updateProjectCategory.updateProjectCategory(id, { name: 'X' }, designer), 403, 'Only Platform Management can manage categories.');
            assertRefused(() => t.c.updateProjectCategory.updateProjectCategory(id, { name: 'X' }, null), 401);
        });
    });

    describe('[51] delete a category', () => {
        let id;
        beforeEach(() => { id = t.entities.category.create('Garage'); });

        it('[51] deletes an unused category', () => {
            assert.deepEqual(t.c.deleteProjectCategory.deleteProjectCategory(id, manager), { message: 'Category deleted.' });
            assert.deepEqual(t.c.viewProjectCategory.viewProjectCategories(), []);
        });

        it('[51] refuses while one project uses it (singular wording)', () => {
            useCategory(id, 1);
            assertRefused(() => t.c.deleteProjectCategory.deleteProjectCategory(id, manager), 409,
                'This category is used by 1 project. Move them to another category first.');
            assert.equal(t.c.viewProjectCategory.viewProjectCategories().length, 1);
        });

        it('[51] refuses while several projects use it (plural wording)', () => {
            useCategory(id, 3);
            assertRefused(() => t.c.deleteProjectCategory.deleteProjectCategory(id, manager), 409,
                'This category is used by 3 projects. Move them to another category first.');
        });

        it('[51] can be deleted once its projects move to another category', () => {
            const other = t.entities.category.create('Study');
            useCategory(id, 1);
            const [project] = t.c.viewPortfolio.viewPortfolio(designer).projects;
            t.c.updateProject.updateProject(project.id, { categoryId: other }, designer);
            t.c.deleteProjectCategory.deleteProjectCategory(id, manager);
            assert.deepEqual(names(t.c.viewProjectCategory.viewProjectCategories()), ['Study']);
        });

        it('[51] an unknown category is not found, a bad id is invalid', () => {
            assertRefused(() => t.c.deleteProjectCategory.deleteProjectCategory(9999, manager), 404, 'Category not found.');
            assertRefused(() => t.c.deleteProjectCategory.deleteProjectCategory('abc', manager), 400, 'Invalid category id.');
        });

        it('[51] only Platform Management can delete', () => {
            assertRefused(() => t.c.deleteProjectCategory.deleteProjectCategory(id, customer), 403, 'Only Platform Management can manage categories.');
            assertRefused(() => t.c.deleteProjectCategory.deleteProjectCategory(id, null), 401);
            assert.equal(t.c.viewProjectCategory.viewProjectCategories().length, 1);
        });
    });

    describe('[52] search categories', () => {
        beforeEach(() => {
            t.entities.category.create('Living Room');
            t.entities.category.create('Kitchen');
            t.entities.category.create('Kids Room');
        });

        it('[52] matches part of a name, not case sensitive', () => {
            assert.deepEqual(names(t.c.searchProjectCategory.searchProjectCategories({ query: 'room' })), ['Kids Room', 'Living Room']);
            assert.deepEqual(names(t.c.searchProjectCategory.searchProjectCategories({ query: 'KITCH' })), ['Kitchen']);
        });

        it('[52] no query (or a blank one) lists everything', () => {
            assert.equal(t.c.searchProjectCategory.searchProjectCategories().length, 3);
            assert.equal(t.c.searchProjectCategory.searchProjectCategories({ query: '   ' }).length, 3);
        });

        it('[52] no match gives an empty list', () => {
            assert.deepEqual(t.c.searchProjectCategory.searchProjectCategories({ query: 'zzz' }), []);
        });

        it('[52] % and _ are searched literally', () => {
            assert.deepEqual(t.c.searchProjectCategory.searchProjectCategories({ query: '%' }), []);
            assert.deepEqual(t.c.searchProjectCategory.searchProjectCategories({ query: '_' }), []);
        });

        it('[52] results carry project counts', () => {
            const kitchen = t.entities.category.findByName('Kitchen').id;
            useCategory(kitchen, 2);
            assert.equal(t.c.searchProjectCategory.searchProjectCategories({ query: 'kitchen' })[0].projectCount, 2);
        });

        it('[52] a non-text query (array) is ignored instead of crashing', () => {
            assert.equal(t.c.searchProjectCategory.searchProjectCategories({ query: ['a'] }).length, 3);
        });
    });
});
