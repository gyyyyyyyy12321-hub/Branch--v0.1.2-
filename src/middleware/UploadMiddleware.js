'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const AppError = require('../utils/AppError');
const ImageStorage = require('../utils/ImageStorage');

const EXTENSION_BY_MIME = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
};

/**
 * Accepts one image per request (JPEG, PNG or WebP, up to maxBytes) and saves it to the uploads folder
 * under a random name. The browser's claimed file type is not trusted: after saving, the file's first bytes
 * must match a real JPEG, PNG or WebP image of the claimed type, otherwise the file is deleted and the request refused.
 * After it runs, req.file holds the file; use UploadMiddleware.publicPathOf(req.file) for projects.image_path.
 */
class UploadMiddleware {
    constructor({ uploadDir, maxBytes }) {
        let multer;
        try {
            multer = require('multer');
        } catch {
            throw new Error('The "multer" package is required for image uploads. Run: npm install');
        }
        this.maxBytes = maxBytes;
        this.multer = multer({
            storage: multer.diskStorage({
                destination: uploadDir,
                filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXTENSION_BY_MIME[file.mimetype])
            }),
            limits: { fileSize: maxBytes, files: 1 },
            fileFilter: (req, file, cb) => {
                if (EXTENSION_BY_MIME[file.mimetype]) return cb(null, true);
                cb(new AppError(400, 'Only JPEG, PNG or WebP images are allowed.'));
            }
        });
    }

    /** Middleware for a single optional image in the form field `fieldName`. */
    single(fieldName) {
        const handler = this.multer.single(fieldName);
        return (req, res, next) => {
            handler(req, res, err => {
                if (err) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        const mb = Math.round(this.maxBytes / (1024 * 1024));
                        return next(new AppError(400, `Image must be ${mb} MB or smaller.`));
                    }
                    return next(err instanceof AppError ? err : new AppError(400, err.message));
                }
                try {
                    this.verifyImage(req);
                } catch (verifyError) {
                    return next(verifyError);
                }
                next();
            });
        };
    }

    /** Throws (and deletes the file) unless req.file really is the image type it claims to be. */
    verifyImage(req) {
        if (!req.file) return;
        const detected = UploadMiddleware.detectMime(req.file.path);
        if (detected !== req.file.mimetype) {
            try { fs.unlinkSync(req.file.path); } catch { /* already gone */ }
            req.file = undefined;
            throw new AppError(400, 'That file is not a valid JPEG, PNG or WebP image.');
        }
    }

    /** Looks at the first bytes of a file and returns 'image/jpeg', 'image/png', 'image/webp' or null. */
    static detectMime(filePath) {
        const head = Buffer.alloc(12);
        const fd = fs.openSync(filePath, 'r');
        try {
            fs.readSync(fd, head, 0, 12, 0);
        } finally {
            fs.closeSync(fd);
        }
        if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
        if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
        if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
        return null;
    }

    /** Public path for an uploaded file, or null when no file was sent. */
    static publicPathOf(file) {
        return file ? ImageStorage.publicPathFor(file.filename) : null;
    }
}

module.exports = UploadMiddleware;
