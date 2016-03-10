'use strict';
const config = require('../config');
const snoowrap = require('snoowrap');
module.exports = new snoowrap({
  client_id: config.reddit_client_id,
  client_secret: config.reddit_client_secret,
  refresh_token: config.reddit_refresh_token,
  user_agent: config.reddit_user_agent
});
