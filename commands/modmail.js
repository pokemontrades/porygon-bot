module.exports = {
  message_regex: /^.modmail (.*)/,
  response: function (message_match) {
    return 'http://hq.porygon.co/search/modmail/' + encodeURIComponent(message_match[1]).replace(/[\[\]!'\(\)]/g, escape);
  }
};
