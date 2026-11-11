'use strict';

/**
 * Base class for all Entity classes (the E in BCE).
 * An Entity owns every SQL statement for its table; Controls and Boundaries never touch the database.
 * The Database is injected through the constructor, so tests can pass an in-memory one.
 * Subclasses set `static tableName` (and `static primaryKey` if it is not "id").
 */
class BaseEntity {
    static tableName = null;
    static primaryKey = 'id';

    constructor(db) {
        if (new.target === BaseEntity) {
            throw new Error('BaseEntity is abstract; extend it.');
        }
        if (!new.target.tableName) {
            throw new Error(`${new.target.name} must define a static tableName.`);
        }
        this.db = db;
    }

    // tableName and primaryKey come from static fields in our own code, never from user input.
    get table() {
        return this.constructor.tableName;
    }

    get primaryKey() {
        return this.constructor.primaryKey;
    }

    findById(id) {
        return this.db.get(`SELECT * FROM ${this.table} WHERE ${this.primaryKey} = ?`, [id]);
    }

    findAll() {
        return this.db.all(`SELECT * FROM ${this.table} ORDER BY ${this.primaryKey}`);
    }

    count() {
        return this.db.get(`SELECT COUNT(*) AS n FROM ${this.table}`).n;
    }

    /** Returns true if a row was deleted. */
    deleteById(id) {
        return this.db.run(`DELETE FROM ${this.table} WHERE ${this.primaryKey} = ?`, [id]).changes > 0;
    }

    /**
     * Rows of this table per local calendar day: [{ day: 'YYYY-MM-DD', count }]. Days without rows are left out.
     * `column` is the UTC timestamp column; `where` is an optional extra condition (with its `params`).
     * The column, table and condition come from our own code, never from user input.
     */
    countPerLocalDay(startUtc, endUtc, offsetHours, { column = 'created_at', where = '1 = 1', params = [] } = {}) {
        const modifier = `${offsetHours >= 0 ? '+' : '-'}${Math.abs(Number(offsetHours))} hours`;
        return this.db.all(
            `SELECT date(${column}, ?) AS day, COUNT(*) AS count FROM ${this.table}
             WHERE ${where} AND ${column} >= ? AND ${column} < ? GROUP BY day ORDER BY day`,
            [modifier, ...params, startUtc, endUtc]
        );
    }

    /**
     * Turns user text into a LIKE pattern that matches it literally (so "%" and "_" typed by a user
     * are not wildcards). Use with: ... LIKE ? ESCAPE '\'
     */
    static likePattern(text) {
        return `%${String(text).replace(/[\\%_]/g, '\\$&')}%`;
    }
}

module.exports = BaseEntity;
