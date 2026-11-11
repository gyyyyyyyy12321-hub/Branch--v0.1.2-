'use strict';

const BaseEntity = require('./BaseEntity');

/** The categories table (names are unique, ignoring case). */
class Category extends BaseEntity {
    static tableName = 'categories';

    /** Returns the new category's id. */
    create(name) {
        return this.db.run('INSERT INTO categories (name) VALUES (?)', [name]).lastInsertRowid;
    }

    /** Case-insensitive lookup (the column uses COLLATE NOCASE). */
    findByName(name) {
        return this.db.get('SELECT * FROM categories WHERE name = ?', [name]);
    }

    rename(id, name) {
        return this.db.run('UPDATE categories SET name = ? WHERE id = ?', [name, id]).changes > 0;
    }

    countProjects(id) {
        return this.db.get('SELECT COUNT(*) AS n FROM projects WHERE category_id = ?', [id]).n;
    }

    /** Every category with the number of projects in it, optionally filtered by name. */
    findAllWithCounts(query = '') {
        const base = `SELECT c.id, c.name,
                             (SELECT COUNT(*) FROM projects p WHERE p.category_id = c.id) AS projectCount
                      FROM categories c`;
        if (!query) return this.db.all(`${base} ORDER BY c.name`);
        return this.db.all(
            `${base} WHERE c.name LIKE ? ESCAPE '\\' ORDER BY c.name`,
            [BaseEntity.likePattern(query)]
        );
    }
}

module.exports = Category;
