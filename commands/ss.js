'use strict';
const rp = require('request-promise');

function findMatch(html) {
  let res = html.match(/var spreadsheetId = "([\w\-]+)"/);
  if (res) {
    return `https://docs.google.com/spreadsheets/d/${res[1]}/pubhtml`;
  }
}

module.exports = {
  message_regex: /^\.ss (https:\/\/[^\?#]+\/\?([\w\-]{6,})[^#]*|https?:\/\/[^# ]*)(#.*)?/,
  response: function ({message_match}) {
    if (message_match[2] !== undefined) {
      return `https://docs.google.com/spreadsheets/d/${message_match[2]}/pubhtml`;
    } else {
      return rp(message_match[1]).then(
        body => findMatch(body) || rp({baseUrl: message_match[1], url: 'static/config.js'}).then(
          body => findMatch(body) || 'Unable to find spreadsheet configuration.'
        ).catch(() => 'Unable to retrieve spreadsheet configuration.')
      ).catch(() => 'Error fetching the specified URL.');
    }
  }
};
