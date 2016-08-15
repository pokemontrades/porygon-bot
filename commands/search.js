module.exports = {
  message_regex: /^\.(ref|user|log|modmail)(?: (.+)|$)/,
  response: function ({message_match}) {
    return 'http://hq.porygon.co/search/' + message_match[1] + '/' + encodeURIComponent(message_match[2] || '').replace(/[!'\(\)]/g, escape);
  }
};
