'use strict';

const Config = require('./config/Config');
const App = require('./App');

const config = Config.load();
if (config.isProduction && config.jwtSecret === 'dev-only-secret-change-me') {
    console.warn('WARNING: set JWT_SECRET in production.');
}

App.build(config).listen();
