'use strict';

const BaseEntity = require('./BaseEntity');

// Shared pieces of the project queries. Shortlist (favourite) counts are always computed, never stored.
const COLUMNS = `
    p.id, p.title, p.description, p.status, p.year,
    p.image_path AS imagePath, p.view_count AS viewCount,
    p.created_at AS createdAt, p.updated_at AS updatedAt,
    p.category_id AS categoryId, c.name AS category,
    p.designer_id AS designerId, dp.name AS designer,
    (SELECT COUNT(*) FROM favourites f WHERE f.project_id = p.id) AS favouriteCount`;

const DETAIL_COLUMNS = `,
    du.status AS designerStatus, dp.location AS designerLocation, dp.phone AS designerPhone,
    dp.description AS designerDescription, dp.services AS designerServices`;

const FROM = `
    FROM projects p
    JOIN categories c ON c.id = p.category_id
    JOIN users du ON du.id = p.designer_id
    JOIN profiles dp ON dp.user_id = p.designer_id`;

// Only projects of Active designers are public (deactivated, suspended and pending designers are hidden).
const VISIBLE = "du.status = 'Active'";

const SORT = {
    newest: 'p.created_at DESC, p.id DESC',
    views: 'p.view_count DESC, p.id DESC',
    favourites: 'favouriteCount DESC, p.view_count DESC, p.id DESC'
};

const COLUMN_FOR = {
    title: 'title', description: 'description', categoryId: 'category_id',
    status: 'status', year: 'year', imagePath: 'image_path'
};

const RESULT_LIMIT = 200;

/** The projects table: a designer's portfolio entries. */
class Project extends BaseEntity {
    static tableName = 'projects';

    /** Returns the new project's id. */
    countCreatedBetween(startUtc, endUtc) {
        return this.db.get('SELECT COUNT(*) AS n FROM projects WHERE created_at >= ? AND created_at < ?', [startUtc, endUtc]).n;
    }

    countCreatedPerDay(startUtc, endUtc, offsetHours) {
        return this.countPerLocalDay(startUtc, endUtc, offsetHours);
    }

    create({ designerId, categoryId, title, description, status, year = null, imagePath = null }) {
        return this.db.run(
            `INSERT INTO projects (designer_id, category_id, title, description, status, year, image_path)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [designerId, categoryId, title, description, status, year, imagePath]
        ).lastInsertRowid;
    }

    /** Updates only the fields present in `fields` (title, description, categoryId, status, year, imagePath). */
    update(id, fields) {
        const keys = Object.keys(fields).filter(key => key in COLUMN_FOR);
        if (!keys.length) return false;
        // column names come from the COLUMN_FOR whitelist, never from user input.
        const assignments = keys.map(key => `${COLUMN_FOR[key]} = ?`).join(', ');
        return this.db.run(
            `UPDATE projects SET ${assignments}, updated_at = datetime('now') WHERE id = ?`,
            [...keys.map(key => fields[key]), id]
        ).changes > 0;
    }

    incrementViewCount(id) {
        return this.db.run('UPDATE projects SET view_count = view_count + 1 WHERE id = ?', [id]).changes > 0;
    }

    /** One project with its designer's public details, whatever the designer's status. Controls decide visibility. */
    findDetailById(id) {
        return this.db.get(`SELECT ${COLUMNS}${DETAIL_COLUMNS} ${FROM} WHERE p.id = ?`, [id]);
    }

    /** Public search: every word must match the title, description, category or designer name. */
    search({ query = '', categoryId = null, sort = 'newest' } = {}) {
        const where = [VISIBLE];
        const params = [];
        for (const word of String(query).split(/\s+/).filter(Boolean).slice(0, 5)) {
            const pattern = BaseEntity.likePattern(word);
            where.push(`(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\'
                         OR c.name LIKE ? ESCAPE '\\' OR dp.name LIKE ? ESCAPE '\\')`);
            params.push(pattern, pattern, pattern, pattern);
        }
        if (categoryId) {
            where.push('p.category_id = ?');
            params.push(categoryId);
        }
        return this.db.all(
            `SELECT ${COLUMNS} ${FROM} WHERE ${where.join(' AND ')} ORDER BY ${SORT[sort] ?? SORT.newest} LIMIT ${RESULT_LIMIT}`,
            params
        );
    }

    /** A designer's own portfolio (all their projects, newest first). */
    findByDesigner(designerId) {
        return this.db.all(
            `SELECT ${COLUMNS} ${FROM} WHERE p.designer_id = ? ORDER BY p.created_at DESC, p.id DESC`,
            [designerId]
        );
    }

    /** A customer's favourites, most recently saved first (hidden designers' projects are left out). */
    findFavouritedByCustomer(customerId) {
        return this.db.all(
            `SELECT ${COLUMNS} ${FROM}
             JOIN favourites fv ON fv.project_id = p.id
             WHERE fv.customer_id = ? AND ${VISIBLE}
             ORDER BY fv.created_at DESC, p.id DESC`,
            [customerId]
        );
    }

    /** Image paths of every project a designer owns (null entries skipped), for cleanup when they are deleted. */
    findImagePathsByDesigner(designerId) {
        return this.db
            .all('SELECT image_path AS imagePath FROM projects WHERE designer_id = ? AND image_path IS NOT NULL', [designerId])
            .map(row => row.imagePath);
    }
}

module.exports = Project;
