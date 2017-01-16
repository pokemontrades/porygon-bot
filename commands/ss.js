'use strict';
const rp = require('request-promise');

module.exports = {
  message_regex: /^\.ss (https:\/\/[^\?#]+\/\?([\w\-]{6,})[^#]*|https?:\/\/[^# ]*)(#.*)?/,
  response: function ({message_match}) {
    if (message_match[2] !== undefined) {
      return `https://docs.google.com/spreadsheets/d/${message_match[2]}/pubhtml`;
    } else {
      let requestUrl = message_match[1].slice(-1) === '/' ? message_match[1] : message_match[1] + '/';
      return rp(requestUrl+'static/config.js').then(function (body) {
        let id = body.match(/var spreadsheetId = "([\w\-]+)"/)
        if (id) {
          return `https://docs.google.com/spreadsheets/d/${id[1]}/pubhtml`;
        } else {
          return 'Unable to parse spreadsheet URL';
        }
      }).catch(function (err) {
        return 'Unable to find spreadsheet configuration.';
      });
    }
  }
};
