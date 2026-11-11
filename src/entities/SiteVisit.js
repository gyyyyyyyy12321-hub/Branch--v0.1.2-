'use strict';

const BaseEntity = require('./BaseEntity');

/** The site_visits table: one row per browser session (story 55). */
class SiteVisit extends BaseEntity {
    static tableName = 'site_visits';

    record() {
        return this.db.run('INSERT INTO site_visits DEFAULT VALUES').lastInsertRowid;
    }

    /** Visits with startUtc <= visited_at < endUtc (UTC 'YYYY-MM-DD HH:MM:SS' strings). */
    countBetween(startUtc, endUtc) {
        return this.db.get(
            'SELECT COUNT(*) AS n FROM site_visits WHERE visited_at >= ? AND visited_at < ?',
            [startUtc, endUtc]
        ).n;
    }

    /** Visits per local calendar day in the period: [{ day: 'YYYY-MM-DD', count }]. Days without visits are left out. */
    countPerDay(startUtc, endUtc, offsetHours) {
        return this.countPerLocalDay(startUtc, endUtc, offsetHours, { column: 'visited_at' });
    }
}

module.exports = SiteVisit;
