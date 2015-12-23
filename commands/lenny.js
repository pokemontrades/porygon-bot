// ( ͡° ͜ʖ ͡°)‎
module.exports = {
  message_regex: /^.lenny/,
  author_regex: /.*/, // (No restriction on author. This line is not really necessary here, since /.*/ is the default anyway.)
  response: function (message_match) {
    /* Due to the way RegExp.prototype.exec() works in javascript, message_match[0] will be '.ping <some text>' (i.e. the entire match).
    * The first matching group, <some text>, is message_match[1]. */
    return "( ͡° ͜ʖ ͡°)‎";
  }
};
