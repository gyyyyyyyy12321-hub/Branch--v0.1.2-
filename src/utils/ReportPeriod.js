'use strict';

const AppError = require('./AppError');

const DAY_MS = 86400000;
const PERIODS = ['daily', 'weekly', 'monthly'];

/**
 * Works out the time range of a daily, weekly (Monday to Sunday) or monthly report.
 * The date is a calendar date in the platform's timezone (offsetHours ahead of UTC); the database stores UTC,
 * so the range is also returned as UTC strings in the database's 'YYYY-MM-DD HH:MM:SS' format.
 */
class ReportPeriod {
    static get PERIODS() {
        return PERIODS;
    }

    /** Today's calendar date ('YYYY-MM-DD') in the platform's timezone. */
    static today(offsetHours, now = Date.now()) {
        return new Date(now + offsetHours * 3600000).toISOString().slice(0, 10);
    }

    static resolve(period, date, offsetHours, now = Date.now()) {
        if (!PERIODS.includes(period)) throw new AppError(400, 'Choose daily, weekly or monthly.');
        const day = date ? String(date).trim() : ReportPeriod.today(offsetHours, now);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
        const parsed = match && Date.UTC(+match[1], +match[2] - 1, +match[3]);
        if (!match || new Date(parsed).toISOString().slice(0, 10) !== day) throw new AppError(400, 'Enter a valid date.');

        let start = parsed, end = parsed + DAY_MS;
        if (period === 'weekly') {
            start = parsed - ((new Date(parsed).getUTCDay() + 6) % 7) * DAY_MS; // back to Monday
            end = start + 7 * DAY_MS;
        } else if (period === 'monthly') {
            start = Date.UTC(+match[1], +match[2] - 1, 1);
            end = Date.UTC(+match[1], +match[2], 1);
        }
        const utc = local => new Date(local - offsetHours * 3600000).toISOString().slice(0, 19).replace('T', ' ');
        const dateOf = local => new Date(local).toISOString().slice(0, 10);
        const days = [];
        for (let t = start; t < end; t += DAY_MS) days.push(dateOf(t));
        return {
            period, date: day,
            from: dateOf(start), to: dateOf(end - DAY_MS), // inclusive local dates
            startUtc: utc(start), endUtc: utc(end),
            days
        };
    }
}

module.exports = ReportPeriod;
