'use strict';

const BaseEntity = require('./BaseEntity');

// Account view: private fields plus the profile name and the latest credential (designers only).
const ACCOUNT_SELECT = `
    SELECT u.id, u.email, u.role, u.status, u.created_at AS createdAt,
           p.name AS name,
           c.status AS credentialStatus,
           c.company_name AS companyName,
           c.registration_number AS registrationNumber
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN credentials c ON c.id = (SELECT MAX(id) FROM credentials WHERE user_id = u.id)`;

/** The users table (accounts). The row from findById/findByEmail includes password_hash; never send it out. */
class User extends BaseEntity {
    static tableName = 'users';

    /** Returns the new user's id. */
    create({ email, passwordHash, role, status }) {
        return this.db.run(
            'INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, ?, ?)',
            [email, passwordHash, role, status]
        ).lastInsertRowid;
    }

    /** Email lookups are case-insensitive (the column uses COLLATE NOCASE). */
    findByEmail(email) {
        return this.db.get('SELECT * FROM users WHERE email = ?', [String(email ?? '').trim()]);
    }

    emailTaken(email, exceptId = 0) {
        return this.db.get('SELECT 1 AS found FROM users WHERE email = ? AND id != ?', [email, exceptId]) !== null;
    }

    countByRole(role) {
        return this.db.get('SELECT COUNT(*) AS n FROM users WHERE role = ?', [role]).n;
    }

    /** Number of accounts with this role and status (e.g. active customers). */
    countByRoleAndStatus(role, status) {
        return this.db.get('SELECT COUNT(*) AS n FROM users WHERE role = ? AND status = ?', [role, status]).n;
    }

    /** Accounts of this role created with startUtc <= created_at < endUtc. */
    countCreatedBetween(role, startUtc, endUtc) {
        return this.db.get(
            'SELECT COUNT(*) AS n FROM users WHERE role = ? AND created_at >= ? AND created_at < ?',
            [role, startUtc, endUtc]
        ).n;
    }

    /** Accounts of this role created per local calendar day: [{ day, count }]. */
    countCreatedPerDay(role, startUtc, endUtc, offsetHours) {
        return this.countPerLocalDay(startUtc, endUtc, offsetHours, { where: 'role = ?', params: [role] });
    }

    /** Safe-to-return account details (no password hash), or null. */
    findAccountById(id) {
        return this.db.get(`${ACCOUNT_SELECT} WHERE u.id = ?`, [id]);
    }

    /** Admin search over email and name, optionally filtered by role and status. */
    searchAccounts({ query = '', role = '', status = '' } = {}) {
        const where = [];
        const params = [];
        if (query) {
            const pattern = BaseEntity.likePattern(query);
            where.push("(u.email LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\')");
            params.push(pattern, pattern);
        }
        if (role) {
            where.push('u.role = ?');
            params.push(role);
        }
        if (status) {
            where.push('u.status = ?');
            params.push(status);
        }
        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        return this.db.all(`${ACCOUNT_SELECT} ${clause} ORDER BY u.id`, params);
    }

    updateEmail(id, email) {
        return this.#update(id, 'email', email);
    }

    updatePasswordHash(id, passwordHash) {
        return this.#update(id, 'password_hash', passwordHash);
    }

    updateRole(id, role) {
        return this.#update(id, 'role', role);
    }

    updateStatus(id, status) {
        return this.#update(id, 'status', status);
    }

    // column is always one of the literals above, never user input.
    #update(id, column, value) {
        return this.db.run(
            `UPDATE users SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`,
            [value, id]
        ).changes > 0;
    }
}

module.exports = User;
