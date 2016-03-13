module.exports = {
  events: ['mode +v', 'mode -v'],
  response ({message_match, bot, eventType}) {
    if (eventType === 'mode +v' && message_match[0] === bot.nick) {
      return 'n_n';
    }
    if (eventType === 'mode -v' && message_match[0] === bot.nick) {
      return 'é_é';
    }
  }
};
