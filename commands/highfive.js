const STACKABLE = false; // :(
const storedHands = new Map();
module.exports = {
  message_regex: /(?:^|\s)(o\/|\\o)(?:\s|$)/i,
  allow: ({isPM}) => !isPM,
  response: function ({message_match: [, message], author_match: [author], channel}) {
    if (!storedHands.has(channel)) storedHands.set(channel, []);
    const channelHands = storedHands.get(channel);

    if (channelHands.length && channelHands[channelHands.length - 1].direction === 'left' && message === 'o/') {
      return author + ' o/\\o ' + storedHands.get(channel).pop().author;
    }
    if (channelHands.length && channelHands[channelHands.length - 1].direction === 'right' && message === '\\o') {
      return channelHands.pop().author + ' o/\\o ' + author;
    }
    channelHands.push({author, direction: message === 'o/' ? 'right' : 'left'});
    if (!STACKABLE && channelHands.length > 1) {
      channelHands.shift();
    }
  }
};
