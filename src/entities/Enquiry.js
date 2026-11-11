'use strict';

const BaseEntity = require('./BaseEntity');

/** The enquiries table: a customer's message to a designer about a project. */
class Enquiry extends BaseEntity {
    static tableName = 'enquiries';

    /** Returns the new enquiry's id. */
    create({ customerId, designerId, projectId, name, email, location = null, budget = null, requirements }) {
        return this.db.run(
            `INSERT INTO enquiries (customer_id, designer_id, project_id, name, email, location, budget, requirements)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [customerId, designerId, projectId, name, email, location, budget, requirements]
        ).lastInsertRowid;
    }

    countBetween(startUtc, endUtc) {
        return this.db.get('SELECT COUNT(*) AS n FROM enquiries WHERE created_at >= ? AND created_at < ?', [startUtc, endUtc]).n;
    }

    countPerDay(startUtc, endUtc, offsetHours) {
        return this.countPerLocalDay(startUtc, endUtc, offsetHours);
    }

    /** Enquiries a designer has received, newest first. projectTitle is null if the project was later deleted. */
    findByDesigner(designerId) {
        return this.db.all(
            `SELECT e.id, e.name, e.email, e.location, e.budget, e.requirements,
                    e.created_at AS createdAt, e.project_id AS projectId, p.title AS projectTitle
             FROM enquiries e
             LEFT JOIN projects p ON p.id = e.project_id
             WHERE e.designer_id = ?
             ORDER BY e.created_at DESC, e.id DESC`,
            [designerId]
        );
    }
}

module.exports = Enquiry;
