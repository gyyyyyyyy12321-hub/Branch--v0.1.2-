'use strict';

const AppError = require('../utils/AppError');

/** Turns thrown errors into consistent JSON responses: { "error": "message", "code": "OPTIONAL_TAG" }. */
class ErrorMiddleware {
    constructor({ isProduction = false } = {}) {
        this.isProduction = isProduction;
    }

    notFound = (req, res, next) => {
        next(new AppError(404, `Not found: ${req.method} ${req.originalUrl}`));
    };

    // Express recognises an error handler by its four parameters, so keep `next`.
    handle = (err, req, res, next) => { // eslint-disable-line no-unused-vars
        const status = err.statusCode || err.status || 500;
        if (status >= 500) console.error(err);

        let message = err.message;
        if (err.type === 'entity.parse.failed') message = 'Request body is not valid JSON.';
        if (status >= 500 && this.isProduction) message = 'Something went wrong on our side.';

        if (res.headersSent) return next(err);

        const body = { error: message };
        if (err instanceof AppError && err.code) body.code = err.code;
        res.status(status).json(body);
    };
}

module.exports = ErrorMiddleware;
