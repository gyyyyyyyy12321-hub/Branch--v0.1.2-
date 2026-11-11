'use strict';

const BaseController = require('./BaseController');
const { ROLES } = require('../constants');

/**
 * Stories 28-32 (the listing side): a designer views their own portfolio with each project's
 * view count (story 31) and shortlist count (story 32), plus totals for the dashboard and analytics.
 */
class ViewPortfolioController {
    constructor({ projectEntity }) {
        this.projectEntity = projectEntity;
    }

    viewPortfolio(actor) {
        BaseController.requireRole(actor, ROLES.DESIGNER, 'Only interior designers have a portfolio.');
        const projects = this.projectEntity.findByDesigner(actor.id);

        const sum = key => projects.reduce((total, project) => total + project[key], 0);
        const mostViewed = projects.reduce((best, project) => (!best || project.viewCount > best.viewCount ? project : best), null);
        return {
            projects,
            totals: {
                projects: projects.length,
                views: sum('viewCount'),
                shortlists: sum('favouriteCount'),
                mostViewed: mostViewed ? { id: mostViewed.id, title: mostViewed.title, viewCount: mostViewed.viewCount } : null
            }
        };
    }
}

module.exports = ViewPortfolioController;
