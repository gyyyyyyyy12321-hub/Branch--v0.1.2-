'use strict';

/**
 * An error with an HTTP status code; ErrorMiddleware turns it into a JSON response.
 * `code` is an optional machine-readable tag (e.g. "ACCOUNT_DEACTIVATED") the front end can react to.
 */
class AppError extends Error {
    constructor(statusCode, message, code = null) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

module.exports = AppError;
