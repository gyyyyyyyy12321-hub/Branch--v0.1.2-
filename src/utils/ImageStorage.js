'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Manages image files in the uploads folder.
 * The database stores only the public path (e.g. "/uploads/abc.jpg"), and it may be null.
 */
class ImageStorage {
    constructor(uploadDir) {
        this.uploadDir = uploadDir;
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    static publicPathFor(filename) {
        return `/uploads/${filename}`;
    }

    /** Copies a file into the uploads folder under destName and returns its public path. */
    copyIn(sourcePath, destName) {
        fs.copyFileSync(sourcePath, path.join(this.uploadDir, destName));
        return ImageStorage.publicPathFor(destName);
    }

    /** Deletes the file behind a public path. Safe to call with null or a missing file. */
    delete(publicPath) {
        if (!publicPath) return;
        const filename = path.basename(publicPath); // basename blocks path traversal
        try {
            fs.unlinkSync(path.join(this.uploadDir, filename));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
    }
}

module.exports = ImageStorage;
