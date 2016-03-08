var STACKABLE = false; // :(
var stored = [];
module.exports = {
  message_regex: /(?:^|\s)(o\/|\\o)(?:\s|$)/i,
  response: function ({message_match, author_match, isPM}) {
    if (isPM) {
      return;
    }
    if (stored.length && stored.slice(-1)[0].direction === 'left' && message_match[1] === 'o/') {
      return stored.pop().author + ' o/\\o ' + author_match[0];
    }
    if (stored.length && stored.slice(-1)[0].direction === 'right' && message_match[1] === '\\o') {
      return author_match[0] + ' o/\\o ' + stored.pop().author;
    }
    stored.push({author: author_match[0], direction: message_match[1] === 'o/' ? 'right' : 'left'});
    if (!STACKABLE && stored.length > 1) {
      stored = stored.slice(1);
    }
  }
};
