'use strict';

/**
 * Control for the health check. It is the template for later Controls:
 * named <Verb><Noun>Controller, one public method named after the story, entities injected.
 */
class ViewHealthController {
    constructor({ userEntity }) {
        this.userEntity = userEntity;
    }

    viewHealth() {
        return {
            status: 'ok',
            time: new Date().toISOString(),
            userCount: this.userEntity.count()
        };
    }
}

module.exports = ViewHealthController;
