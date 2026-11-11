'use strict';

// npm run seed:bulk : wipes the database file and loads a large data set (500+ rows per table, 1 Oct to 16 Nov 2026).
// BULK_CATEGORIES=500 npm run seed:bulk   also creates 500 categories (the default is 30).
const fs = require('node:fs');
const Config = require('../src/config/Config');
const Database = require('../src/database/Database');
const BulkSeeder = require('../src/database/BulkSeeder');
const ImageStorage = require('../src/utils/ImageStorage');

const config = Config.load();

if (config.dbPath !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
        fs.rmSync(config.dbPath + suffix, { force: true });
    }
}

const db = Database.open(config.dbPath);
db.initialise(config.schemaPath);
// Images from an earlier bulk run belong to a database that was just wiped, so remove them (other uploads are left alone).
if (fs.existsSync(config.uploadDir)) {
    for (const f of fs.readdirSync(config.uploadDir)) {
        if (/^seed-project-/.test(f)) fs.rmSync(`${config.uploadDir}/${f}`, { force: true });
    }
}

const seeder = new BulkSeeder({ db, config, imageStorage: new ImageStorage(config.uploadDir) });
seeder.run();

for (const table of ['users', 'profiles', 'credentials', 'categories', 'projects', 'favourites', 'enquiries', 'site_visits']) {
    console.log(`${table.padEnd(12)} ${db.get(`SELECT COUNT(*) AS n FROM ${table}`).n}`);
}
console.log(`Cover images used: ${seeder.imagesUsed ?? 0} ` + JSON.stringify(seeder.imagesByOrder ?? {}));
console.log(`All seeded accounts use the password: ${BulkSeeder.SEED_PASSWORD}`);
db.close();
