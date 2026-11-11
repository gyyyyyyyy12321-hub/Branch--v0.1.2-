'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Thin wrapper around a synchronous SQLite driver.
 * Uses better-sqlite3 when it is installed, otherwise Node's built-in node:sqlite,
 * so the project runs with no database server and no native build.
 * Only prepare/run/get/all/exec are used, which both drivers share.
 */
class Database {
    constructor(handle, filePath) {
        this.handle = handle;
        this.filePath = filePath;
    }

    static open(filePath) {
        if (filePath !== ':memory:') {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
        const db = new Database(Database.#openDriver(filePath), filePath);
        db.exec('PRAGMA foreign_keys = ON');
        return db;
    }

    static #openDriver(filePath) {
        try {
            const BetterSqlite3 = require('better-sqlite3');
            return new BetterSqlite3(filePath);
        } catch {
            // Not installed (or its native binary failed to load): use the built-in driver.
            const { DatabaseSync } = require('node:sqlite');
            return new DatabaseSync(filePath);
        }
    }

    /** Create tables if they do not exist yet. */
    initialise(schemaPath) {
        this.exec(fs.readFileSync(schemaPath, 'utf8'));
    }

    exec(sql) {
        this.handle.exec(sql);
    }

    /** INSERT / UPDATE / DELETE. Returns { changes, lastInsertRowid } as plain numbers. */
    run(sql, params = []) {
        const result = this.handle.prepare(sql).run(...params);
        return {
            changes: Number(result.changes),
            lastInsertRowid: Number(result.lastInsertRowid)
        };
    }

    /** First matching row as a plain object, or null. */
    get(sql, params = []) {
        const row = this.handle.prepare(sql).get(...params);
        return row ? { ...row } : null;
    }

    /** All matching rows as plain objects. */
    all(sql, params = []) {
        return this.handle.prepare(sql).all(...params).map(row => ({ ...row }));
    }

    /** Runs fn inside a transaction; rolls back if it throws. */
    transaction(fn) {
        this.exec('BEGIN');
        try {
            const result = fn();
            this.exec('COMMIT');
            return result;
        } catch (err) {
            this.exec('ROLLBACK');
            throw err;
        }
    }

    close() {
        this.handle.close();
    }
}

module.exports = Database;
