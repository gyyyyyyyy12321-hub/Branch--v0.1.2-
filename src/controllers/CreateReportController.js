'use strict';

const BaseController = require('./BaseController');
const ReportPeriod = require('../utils/ReportPeriod');
const { ROLES, ACCOUNT_STATUS } = require('../constants');

/**
 * Story 58: Platform Management generates a daily, weekly or monthly platform report.
 * Activity numbers cover the chosen period (with a per-day breakdown of each, for the bar graphs);
 * the active account counts are the current totals.
 */
class CreateReportController {
    constructor({ userEntity, projectEntity, favouriteEntity, enquiryEntity, siteVisitEntity, offsetHours }) {
        this.userEntity = userEntity;
        this.projectEntity = projectEntity;
        this.favouriteEntity = favouriteEntity;
        this.enquiryEntity = enquiryEntity;
        this.siteVisitEntity = siteVisitEntity;
        this.offsetHours = offsetHours;
    }

    createReport(input = {}, actor) {
        BaseController.requireRole(actor, ROLES.PLATFORM_MANAGEMENT, 'Only Platform Management can generate reports.');
        const range = ReportPeriod.resolve(input.period, input.date, this.offsetHours);
        const { startUtc, endUtc } = range;

        // One zero-filled series per statistic, so every day of the period appears even with no activity.
        const off = this.offsetHours;
        const series = rows => new Map(rows.map(r => [r.day, r.count]));
        const perDay = {
            siteVisits: series(this.siteVisitEntity.countPerDay(startUtc, endUtc, off)),
            newCustomers: series(this.userEntity.countCreatedPerDay(ROLES.CUSTOMER, startUtc, endUtc, off)),
            newDesigners: series(this.userEntity.countCreatedPerDay(ROLES.DESIGNER, startUtc, endUtc, off)),
            newProjects: series(this.projectEntity.countCreatedPerDay(startUtc, endUtc, off)),
            favouritesAdded: series(this.favouriteEntity.countPerDay(startUtc, endUtc, off)),
            enquiriesSent: series(this.enquiryEntity.countPerDay(startUtc, endUtc, off))
        };
        return {
            period: range.period,
            from: range.from,
            to: range.to,
            generatedAt: new Date().toISOString(),
            activity: {
                siteVisits: this.siteVisitEntity.countBetween(startUtc, endUtc),
                newCustomers: this.userEntity.countCreatedBetween(ROLES.CUSTOMER, startUtc, endUtc),
                newDesigners: this.userEntity.countCreatedBetween(ROLES.DESIGNER, startUtc, endUtc),
                newProjects: this.projectEntity.countCreatedBetween(startUtc, endUtc),
                favouritesAdded: this.favouriteEntity.countBetween(startUtc, endUtc),
                enquiriesSent: this.enquiryEntity.countBetween(startUtc, endUtc)
            },
            platform: {
                activeCustomers: this.userEntity.countByRoleAndStatus(ROLES.CUSTOMER, ACCOUNT_STATUS.ACTIVE),
                activeDesigners: this.userEntity.countByRoleAndStatus(ROLES.DESIGNER, ACCOUNT_STATUS.ACTIVE),
                totalProjects: this.projectEntity.count()
            },
            dailyActivity: range.days.map(day => ({
                day, ...Object.fromEntries(Object.entries(perDay).map(([key, counts]) => [key, counts.get(day) ?? 0]))
            }))
        };
    }
}

module.exports = CreateReportController;
