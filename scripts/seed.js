'use strict';

// npm run seed : wipes the database file and loads fresh sample data.
const fs = require('node:fs');
const Config = require('../src/config/Config');
const Database = require('../src/database/Database');
const Seeder = require('../src/database/Seeder');
const ImageStorage = require('../src/utils/ImageStorage');

const config = Config.load();

if (config.dbPath !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
        fs.rmSync(config.dbPath + suffix, { force: true });
    }
}

const db = Database.open(config.dbPath);
db.initialise(config.schemaPath);
new Seeder({ db, config, imageStorage: new ImageStorage(config.uploadDir) }).run();

const count = table => db.get(`SELECT COUNT(*) AS n FROM ${table}`).n;
console.log(
    `Seeded ${count('users')} users, ${count('categories')} categories, ${count('projects')} projects, ` +
    `${count('favourites')} favourites, ${count('enquiries')} enquiries, ${count('site_visits')} site visits.`
);
console.log(`All seeded accounts use the password: ${Seeder.SEED_PASSWORD}`);
db.close();
