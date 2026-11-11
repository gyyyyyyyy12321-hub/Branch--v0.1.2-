'use strict';

const CookieParser = require('../utils/CookieParser');

/**
 * Counts one site visit per browser session (story 55).
 * A session cookie marks the browser as already counted. Failures never block the page.
 */
class SiteVisitMiddleware {
    constructor({ siteVisitEntity, cookieName }) {
        this.siteVisitEntity = siteVisitEntity;
        this.cookieName = cookieName;
    }

    record = (req, res, next) => {
        try {
            const cookies = CookieParser.parse(req.headers.cookie);
            if (!cookies[this.cookieName]) {
                this.siteVisitEntity.record();
                res.cookie(this.cookieName, '1', { httpOnly: true, sameSite: 'lax' }); // no maxAge = session cookie
            }
        } catch (err) {
            console.error('Could not record site visit:', err.message);
        }
        next();
    };
}

module.exports = SiteVisitMiddleware;
