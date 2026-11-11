'use strict';

const BaseEntity = require('./BaseEntity');
const { CREDENTIAL_STATUS } = require('../constants');

const CREDENTIAL_SELECT = `
    SELECT id, user_id AS userId, company_name AS companyName, registration_number AS registrationNumber,
           status, submitted_at AS submittedAt, reviewed_at AS reviewedAt
    FROM credentials`;

/** The credentials table: company details a designer submits so an admin can approve the account. */
class Credential extends BaseEntity {
    static tableName = 'credentials';

    create({ userId, companyName, registrationNumber, status = CREDENTIAL_STATUS.PENDING }) {
        return this.db.run(
            'INSERT INTO credentials (user_id, company_name, registration_number, status) VALUES (?, ?, ?, ?)',
            [userId, companyName, registrationNumber, status]
        ).lastInsertRowid;
    }

    /** The most recent submission for a user, or null. */
    findLatestByUserId(userId) {
        return this.db.get(`${CREDENTIAL_SELECT} WHERE user_id = ? ORDER BY id DESC LIMIT 1`, [userId]);
    }

    /** Replaces the details of a still-pending submission and refreshes its date. */
    updatePending(id, { companyName, registrationNumber }) {
        return this.db.run(
            `UPDATE credentials SET company_name = ?, registration_number = ?, submitted_at = datetime('now')
             WHERE id = ? AND status = ?`,
            [companyName, registrationNumber, id, CREDENTIAL_STATUS.PENDING]
        ).changes > 0;
    }

    /** Marks a submission Approved or Rejected. */
    review(id, status) {
        return this.db.run(
            "UPDATE credentials SET status = ?, reviewed_at = datetime('now') WHERE id = ?",
            [status, id]
        ).changes > 0;
    }
}

module.exports = Credential;
