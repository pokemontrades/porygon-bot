const STACKABLE = false; // :(
const storedHands = new Map();
const rightHand = /^o\/$/i;
const leftHand = /^\\o$/i;
module.exports = {
  message_regex: /(?:^|\s)(o\/|\\o)(?:\s|$)/i,
  allow: ({isPM}) => !isPM,
  response: function ({message_match: [, message], author_match: [author], channel}) {
    if (!storedHands.has(channel)) storedHands.set(channel, []);
    const channelHands = storedHands.get(channel);

    if (channelHands.length && channelHands[channelHands.length - 1].direction === 'left' && rightHand.test(message)) {
      return author + ' o/\\o ' + storedHands.get(channel).pop().author;
    }
    if (channelHands.length && channelHands[channelHands.length - 1].direction === 'right' && leftHand.test(message)) {
      return channelHands.pop().author + ' o/\\o ' + author;
    }
    channelHands.push({author, direction: rightHand.test(message) ? 'right' : 'left'});
    if (!STACKABLE && channelHands.length > 1) {
      channelHands.shift();
    }
  }
};
