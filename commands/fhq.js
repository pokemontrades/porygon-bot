'use strict';

module.exports = {
  message_regex: /^\.fhq(?: (?:\/u\/)?([\w-]+))?/,
  response: ({ message_match: [, username] }) => `https://hq.porygon.co${username ? `/u/${username}` : ''}`
};
