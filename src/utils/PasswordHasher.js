'use strict';

const crypto = require('node:crypto');

/** Password hashing with scrypt (built into Node, so no extra package is needed). */
class PasswordHasher {
    static #KEY_LENGTH = 64;
    static #dummyHash = null;

    /** Returns "scrypt$<salt hex>$<hash hex>". */
    static hash(password) {
        const salt = crypto.randomBytes(16);
        const derived = crypto.scryptSync(String(password), salt, PasswordHasher.#KEY_LENGTH);
        return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
    }

    static verify(password, stored) {
        if (typeof stored !== 'string') return false;
        const [scheme, saltHex, hashHex] = stored.split('$');
        if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
        const expected = Buffer.from(hashHex, 'hex');
        const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);
        return crypto.timingSafeEqual(expected, actual);
    }

    /**
     * Like verify, but `stored` may be missing (unknown email). A dummy hash is checked in that case so
     * "no such account" and "wrong password" take the same time and cannot be told apart.
     */
    static verifyOptional(password, stored) {
        if (!stored) {
            PasswordHasher.verify(String(password ?? ''), PasswordHasher.#dummy());
            return false;
        }
        return PasswordHasher.verify(String(password ?? ''), stored);
    }

    /** A 12-character temporary password with no look-alike characters (no 0/O, 1/l/I). */
    static generateTemporary() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        let out = '';
        for (const byte of crypto.randomBytes(12)) out += alphabet[byte % alphabet.length];
        return out;
    }

    static #dummy() {
        return (PasswordHasher.#dummyHash ??= PasswordHasher.hash('dummy-password'));
    }
}

module.exports = PasswordHasher;
