'use strict';

const crypto = require('node:crypto');

/**
 * Creates and checks signed login tokens (HMAC-SHA256, JWT-style: header.payload.signature).
 * Built on node:crypto so no extra package is needed.
 */
class TokenService {
    constructor(secret) {
        if (!secret) throw new Error('TokenService needs a secret.');
        this.secret = secret;
    }

    sign(payload, ttlSeconds) {
        const now = Math.floor(Date.now() / 1000);
        const header = TokenService.#encode({ alg: 'HS256', typ: 'JWT' });
        const body = TokenService.#encode({ ...payload, iat: now, exp: now + ttlSeconds });
        return `${header}.${body}.${this.#signature(`${header}.${body}`)}`;
    }

    /** Returns the payload if the token is genuine and unexpired, otherwise null. */
    verify(token) {
        if (typeof token !== 'string') return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, body, signature] = parts;

        const expected = Buffer.from(this.#signature(`${header}.${body}`));
        const actual = Buffer.from(signature);
        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

        try {
            const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
            if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
            return payload;
        } catch {
            return null;
        }
    }

    #signature(data) {
        return crypto.createHmac('sha256', this.secret).update(data).digest('base64url');
    }

    static #encode(object) {
        return Buffer.from(JSON.stringify(object)).toString('base64url');
    }
}

module.exports = TokenService;
