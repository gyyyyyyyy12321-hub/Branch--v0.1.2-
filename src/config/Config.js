'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

/** Reads settings from environment variables (and an optional .env file) with safe defaults. */
class Config {
    constructor(env = process.env) {
        this.rootDir = ROOT_DIR;
        this.nodeEnv = env.NODE_ENV || 'development';
        this.port = Number(env.PORT) || 3000;

        this.dbPath = env.DB_PATH === ':memory:'
            ? ':memory:'
            : path.resolve(ROOT_DIR, env.DB_PATH || 'data/app.db');
        this.schemaPath = path.join(ROOT_DIR, 'database', 'schema.sql');

        this.publicDir = path.join(ROOT_DIR, 'public');
        this.uploadDir = path.resolve(ROOT_DIR, env.UPLOAD_DIR || 'uploads');
        this.seedImageDir = path.join(ROOT_DIR, 'seed-images');
        this.maxUploadBytes = 5 * 1024 * 1024;

        this.jwtSecret = env.JWT_SECRET || 'dev-only-secret-change-me';
        this.tokenTtlSeconds = 8 * 60 * 60;
        this.authCookieName = 'idp_token';
        this.visitCookieName = 'idp_visit';

        // Reports group by calendar day in this timezone (hours ahead of UTC). Default 8 = Singapore.
        const offset = Number(env.REPORT_UTC_OFFSET_HOURS ?? 8);
        this.reportUtcOffsetHours = Number.isInteger(offset) && Math.abs(offset) <= 14 ? offset : 8;
    }

    get isProduction() {
        return this.nodeEnv === 'production';
    }

    static load() {
        const envFile = path.join(ROOT_DIR, '.env');
        if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
            process.loadEnvFile(envFile);
        }
        return new Config();
    }
}

module.exports = Config;
