'use strict';

const AppError = require('./AppError');

/** Input checks used by Controls. Every method returns the cleaned value or throws a 400 AppError. */
class Validator {
    static email(value) {
        const v = String(value ?? '').trim();
        if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
            throw new AppError(400, 'Enter a valid email address.');
        }
        return v;
    }

    static password(value) {
        const v = String(value ?? '');
        if (v.length < 8) throw new AppError(400, 'Password must be at least 8 characters.');
        if (v.length > 128) throw new AppError(400, 'Password must be 128 characters or fewer.');
        return v;
    }

    static requiredText(value, label, max = 200) {
        const v = String(value ?? '').trim();
        if (!v) throw new AppError(400, `${label} is required.`);
        if (v.length > max) throw new AppError(400, `${label} must be ${max} characters or fewer.`);
        return v;
    }

    /** Trimmed text, or null when empty or missing. */
    static optionalText(value, label, max = 1000) {
        if (value === undefined || value === null) return null;
        const v = String(value).trim();
        if (!v) return null;
        if (v.length > max) throw new AppError(400, `${label} must be ${max} characters or fewer.`);
        return v;
    }

    static id(value, label = 'id') {
        const n = Number(value);
        if (!Number.isInteger(n) || n <= 0) throw new AppError(400, `Invalid ${label}.`);
        return n;
    }

    static oneOf(value, allowed, label) {
        if (!allowed.includes(value)) throw new AppError(400, `${label} is not valid.`);
        return value;
    }
}

module.exports = Validator;
