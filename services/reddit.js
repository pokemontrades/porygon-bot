'use strict';
var request = require('request-promise'),
  moment = require('moment'),
  _ = require('lodash'),
  querystring = require('querystring'),
  resetTime = moment().add(600, 'seconds'),
  NodeCache = require('node-cache'),
  tokenCache = new NodeCache({stdTTL: 3480}),
  config = require('../config.js'),
  left = 600;
function refreshToken () {
  var access_token = tokenCache.get(config.reddit_refresh_token);
  if (access_token) {
    return Promise.resolve(access_token);
  }
  return request.post({
    url: 'https://www.reddit.com/api/v1/access_token',
    headers: {
      Authorization: 'Basic ' + new Buffer(config.reddit_client_id + ":" + config.reddit_client_secret).toString('base64'),
      'User-Agent': config.reddit_user_agent,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=refresh_token&refresh_token=' + config.reddit_refresh_token,
    json: true
  }).then(function (response) {
    tokenCache.set(config.reddit_refresh_token, response.access_token);
    return response.access_token;
  }, function (error) {
    console.log('Error refreshing token: ' + error);
    throw {error_message: 'Error communicating with reddit.'};
  });
}
function makeRequest (requestType, url, data) {
  return refreshToken().then(function (access_token) {
    if (moment().isBefore(resetTime) && left < 2) {
      throw 'Ratelimit reached';
    }
    data = _.assign(data || {}, {raw_json: 1});
    return request({
      url: 'https://oauth.reddit.com' + url + (requestType.toLowerCase() === 'get' ? '?' + querystring.encode(data) : ''),
      headers: {
        'User-Agent': config.reddit_user_agent,
        Authorization: 'bearer ' + access_token
      },
      resolveWithFullResponse: true,
      method: requestType,
      formData: requestType.toLowerCase() === 'post' ? data : undefined
    }).then(function (response) {
      updateRateLimits(response);
      return JSON.parse(response.body);
    }, function (error) {
      console.log('Error: request to ' + url + ' returned an error: ' + error);
      throw {error_message: 'Error communicating with reddit.'};
    });
  });
}
function updateRateLimits (response) {
  if (response && response.headers && response.headers['x-ratelimit-remaining'] && response.headers['x-ratelimit-reset']) {
    left = response.headers['x-ratelimit-remaining'];
    resetTime = moment().add(response.headers['x-ratelimit-reset'], 'seconds');
  }
}
exports.getWikiPage = function (subreddit, page) {
  return makeRequest('get', '/r/' + subreddit + '/wiki/' + page).then(response => (response.data.content_md));
};
exports.editWikiPage = function (subreddit, page, content, reason) {
  return makeRequest('post', '/r/' + subreddit + '/api/wiki/edit', {content: content, page: page, reason: reason});
};
exports.getItemById = function (item_id) {
  if (item_id.slice(0, 3) === 't4_') {
    let findMessageInTree = function (tree) {
      if (tree.data.name === item_id) {
        return tree;
      }
      if (tree.data.replies) {
        return _.find(tree.data.replies.data.children, findMessageInTree);
      }
    };
    return makeRequest('get', '/message/messages/' + item_id.slice(3)).then(response => (response.data.children[0])).then(findMessageInTree);
  }
  return makeRequest('get', '/api/info', {id: item_id}).then(response => (response.data.children[0]));
};
exports.getCorrectUsername = function (name) { // Gets the correct capitalization for a reddit username, in order to store it properly in usernotes.
  return makeRequest('get', '/user/' + name + '/about').then(response => (response.data.name));
};
