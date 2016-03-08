// respond cutely to pets
module.exports = {
    message_regex: /pets ([^ ]*)/,
    events: ['action'],
    response: function({message_match, bot}) {
        if (message_match[1].toUpperCase() === bot.nick.toUpperCase()) {
            return 'n_n';
        }
    }
};
