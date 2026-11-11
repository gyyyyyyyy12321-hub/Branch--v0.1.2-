'use strict';

const BaseEntity = require('./BaseEntity');

/** The favourites table: which customer saved which project (composite key, so no single id). */
class Favourite extends BaseEntity {
    static tableName = 'favourites';

    findById() {
        throw new Error('Favourite has a composite key; use isFavourite(customerId, projectId).');
    }

    deleteById() {
        throw new Error('Favourite has a composite key; use remove(customerId, projectId).');
    }

    countBetween(startUtc, endUtc) {
        return this.db.get('SELECT COUNT(*) AS n FROM favourites WHERE created_at >= ? AND created_at < ?', [startUtc, endUtc]).n;
    }

    countPerDay(startUtc, endUtc, offsetHours) {
        return this.countPerLocalDay(startUtc, endUtc, offsetHours);
    }

    /** Returns true if it was newly saved, false if it was already a favourite. */
    add(customerId, projectId) {
        return this.db.run(
            'INSERT OR IGNORE INTO favourites (customer_id, project_id) VALUES (?, ?)',
            [customerId, projectId]
        ).changes > 0;
    }

    /** Returns true if something was removed. */
    remove(customerId, projectId) {
        return this.db.run(
            'DELETE FROM favourites WHERE customer_id = ? AND project_id = ?',
            [customerId, projectId]
        ).changes > 0;
    }

    isFavourite(customerId, projectId) {
        return this.db.get(
            'SELECT 1 AS found FROM favourites WHERE customer_id = ? AND project_id = ?',
            [customerId, projectId]
        ) !== null;
    }

    /** Set of project ids a customer has saved, for marking search results. */
    projectIdsByCustomer(customerId) {
        return new Set(
            this.db.all('SELECT project_id AS projectId FROM favourites WHERE customer_id = ?', [customerId])
                .map(row => row.projectId)
        );
    }

    countForProject(projectId) {
        return this.db.get('SELECT COUNT(*) AS n FROM favourites WHERE project_id = ?', [projectId]).n;
    }
}

module.exports = Favourite;
