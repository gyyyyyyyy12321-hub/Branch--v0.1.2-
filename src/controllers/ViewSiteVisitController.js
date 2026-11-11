'use strict';

const BaseController = require('./BaseController');
const ReportPeriod = require('../utils/ReportPeriod');
const { ROLES } = require('../constants');

/** Story 55: Platform Management views the number of site visits (one visit per browser session). */
class ViewSiteVisitController {
    constructor({ siteVisitEntity, offsetHours }) {
        this.siteVisitEntity = siteVisitEntity;
        this.offsetHours = offsetHours;
    }

    viewSiteVisits(actor) {
        BaseController.requireRole(actor, ROLES.PLATFORM_MANAGEMENT, 'Only Platform Management can view site visits.');
        const now = Date.now();
        const today = ReportPeriod.resolve('daily', null, this.offsetHours, now);
        const week = ReportPeriod.resolve('weekly', null, this.offsetHours, now);
        const month = ReportPeriod.resolve('monthly', null, this.offsetHours, now);

        // Last 14 days including today, zero-filled so the chart has no gaps.
        const lastDay = today.days[0];
        const startMs = Date.parse(lastDay) - 13 * 86400000;
        const days = Array.from({ length: 14 }, (_, i) => new Date(startMs + i * 86400000).toISOString().slice(0, 10));
        const first = ReportPeriod.resolve('daily', days[0], this.offsetHours, now);
        const counts = new Map(this.siteVisitEntity.countPerDay(first.startUtc, today.endUtc, this.offsetHours).map(r => [r.day, r.count]));

        return {
            total: this.siteVisitEntity.count(),
            today: this.siteVisitEntity.countBetween(today.startUtc, today.endUtc),
            thisWeek: this.siteVisitEntity.countBetween(week.startUtc, week.endUtc),
            thisMonth: this.siteVisitEntity.countBetween(month.startUtc, month.endUtc),
            lastDays: days.map(day => ({ day, count: counts.get(day) ?? 0 }))
        };
    }
}

module.exports = ViewSiteVisitController;
