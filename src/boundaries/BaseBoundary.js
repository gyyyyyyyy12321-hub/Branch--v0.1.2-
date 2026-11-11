'use strict';

const express = require('express');

/**
 * Base class for Boundary classes (the B in BCE): they receive HTTP requests, call a Control,
 * and shape the response. They hold no business rules and run no SQL.
 * Subclasses implement registerRoutes() and add routes to this.router.
 */
class BaseBoundary {
    constructor() {
        if (new.target === BaseBoundary) {
            throw new Error('BaseBoundary is abstract; extend it.');
        }
        this.router = express.Router();
        this.registered = false;
    }

    registerRoutes() {
        throw new Error(`${this.constructor.name} must implement registerRoutes().`);
    }

    /** Registers routes once and returns the Express router. */
    getRouter() {
        if (!this.registered) {
            this.registerRoutes();
            this.registered = true;
        }
        return this.router;
    }

    /** Wraps a handler so thrown errors and rejected promises reach ErrorMiddleware. */
    handle(handler) {
        return (req, res, next) => {
            Promise.resolve()
                .then(() => handler.call(this, req, res, next))
                .catch(next);
        };
    }
}

module.exports = BaseBoundary;
