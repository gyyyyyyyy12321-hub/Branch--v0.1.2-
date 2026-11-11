'use strict';

/** Minimal Cookie header parser (replaces the cookie-parser package). */
class CookieParser {
    static parse(header) {
        const cookies = {};
        if (!header) return cookies;
        for (const part of header.split(';')) {
            const index = part.indexOf('=');
            if (index < 0) continue;
            const name = part.slice(0, index).trim();
            const value = part.slice(index + 1).trim();
            try {
                cookies[name] = decodeURIComponent(value);
            } catch {
                cookies[name] = value;
            }
        }
        return cookies;
    }
}

module.exports = CookieParser;
