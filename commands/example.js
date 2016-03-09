// Example command. If someone starts a message with a single character followed by 'ping <some text>', the bot replies with <some text>.
module.exports = {
  message_regex: /^.ping (.*)/,
  author_regex: /.*/, // (No restriction on author. This line is not really necessary here, since /.*/ is the default anyway.)
  response: function ({message_match}) {
    /* Due to the way RegExp.prototype.exec() works in javascript, message_match[0] will be '.ping <some text>' (i.e. the entire match).
    * The first matching group, <some text>, is message_match[1]. */
    return message_match[1];
  }
};
