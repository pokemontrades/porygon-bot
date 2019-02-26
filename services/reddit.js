'use strict';
const config = require('../config');
const snoowrap = require('snoowrap');
if (config.reddit.enabled) {
    module.exports = new snoowrap({
        client_id: config.reddit.client_id,
        client_secret: config.reddit.client_secret,
        refresh_token: config.reddit.refresh_token,
        user_agent: config.reddit.user_agent
    });
} else {
    module.exports = false;
}
