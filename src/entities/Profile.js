'use strict';

const BaseEntity = require('./BaseEntity');

const EDITABLE_FIELDS = ['name', 'phone', 'description', 'location', 'services'];

const PROFILE_SELECT = `
    SELECT p.user_id AS userId, p.name, p.phone, p.description, p.location, p.services,
           u.role, u.status
    FROM profiles p
    JOIN users u ON u.id = p.user_id`;

/** The profiles table: public-facing details, one row per user (primary key is user_id). */
class Profile extends BaseEntity {
    static tableName = 'profiles';
    static primaryKey = 'user_id';

    create(userId, { name, phone = null, description = null, location = null, services = null }) {
        this.db.run(
            'INSERT INTO profiles (user_id, name, phone, description, location, services) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, name, phone, description, location, services]
        );
    }

    findByUserId(userId) {
        return this.db.get(`${PROFILE_SELECT} WHERE p.user_id = ?`, [userId]);
    }

    /** Updates only the editable fields present in `fields`. Returns true if a row changed. */
    update(userId, fields) {
        const columns = Object.keys(fields).filter(key => EDITABLE_FIELDS.includes(key));
        if (!columns.length) return false;
        // column names come from the EDITABLE_FIELDS whitelist, never from user input.
        const assignments = columns.map(column => `${column} = ?`).join(', ');
        return this.db.run(
            `UPDATE profiles SET ${assignments} WHERE user_id = ?`,
            [...columns.map(column => fields[column]), userId]
        ).changes > 0;
    }

    search(query = '') {
        if (!query) return this.db.all(`${PROFILE_SELECT} ORDER BY p.name`);
        const pattern = BaseEntity.likePattern(query);
        return this.db.all(
            `${PROFILE_SELECT}
             WHERE p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\'
                OR p.location LIKE ? ESCAPE '\\' OR p.services LIKE ? ESCAPE '\\'
             ORDER BY p.name`,
            [pattern, pattern, pattern, pattern]
        );
    }
}

module.exports = Profile;
