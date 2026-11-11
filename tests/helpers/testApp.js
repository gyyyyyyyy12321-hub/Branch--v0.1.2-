'use strict';

// Builds the real application wiring (entities + controllers) on a throw-away in-memory database.
// Nothing here touches data/app.db, and no demo data is seeded, so every test starts from an empty system.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const SRC = path.join(__dirname, '..', '..', 'src');
const Config = require(path.join(SRC, 'config', 'Config'));
const Database = require(path.join(SRC, 'database', 'Database'));
const App = require(path.join(SRC, 'App'));
const ImageStorage = require(path.join(SRC, 'utils', 'ImageStorage'));
const PasswordHasher = require(path.join(SRC, 'utils', 'PasswordHasher'));
const { ROLES, ACCOUNT_STATUS } = require(path.join(SRC, 'constants'));

const PASSWORD = 'Password123!';
let counter = 0;

/** A fresh, empty system. Returns { app, c (controllers), entities, makeUser }. */
function buildTestApp() {
    const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idp-test-uploads-'));
    const config = new Config({ DB_PATH: ':memory:', UPLOAD_DIR: uploadDir });
    const db = Database.open(':memory:');
    db.initialise(config.schemaPath);
    const app = new App({ config, db, imageStorage: new ImageStorage(uploadDir) });

    /**
     * Inserts an account directly through the entities (so a test can start from any state, including
     * Suspended or Pending) and returns the "actor" object the controllers expect (what req.user holds).
     */
    function makeUser({ role = ROLES.CUSTOMER, status = ACCOUNT_STATUS.ACTIVE, email, name, password = PASSWORD } = {}) {
        counter += 1;
        email = email ?? `user${counter}@example.com`;
        const id = app.userEntity.create({ email, passwordHash: PasswordHasher.hash(password), role, status });
        app.profileEntity.create(id, { name: name ?? `Test User ${counter}` });
        return { id, email, role, status, password };
    }

    return {
        app,
        c: app.controllers,
        entities: {
            user: app.userEntity, profile: app.profileEntity, credential: app.credentialEntity,
            project: app.projectEntity, category: app.categoryEntity, favourite: app.favouriteEntity,
            enquiry: app.enquiryEntity, siteVisit: app.siteVisitEntity
        },
        makeUser,
        /** The current account as stored in the database. */
        accountOf: user => app.userEntity.findAccountById(user.id),
        /** The actor as the login check would build it for the next request (fresh role and status). */
        actorOf: user => {
            const row = app.userEntity.findById(user.id);
            return { id: row.id, email: row.email, role: row.role, status: row.status };
        }
    };
}

/** Asserts that fn throws an AppError with this HTTP status and (optionally) a message matching `message`. */
function assertRefused(fn, statusCode, message) {
    assert.throws(fn, err => {
        assert.equal(err.name, 'AppError', `expected an AppError but got: ${err.stack}`);
        assert.equal(err.statusCode, statusCode, `expected status ${statusCode} but got ${err.statusCode}: ${err.message}`);
        if (message instanceof RegExp) assert.match(err.message, message);
        else if (typeof message === 'string') assert.equal(err.message, message);
        return true;
    });
}

module.exports = { buildTestApp, assertRefused, PASSWORD, ROLES, ACCOUNT_STATUS };
