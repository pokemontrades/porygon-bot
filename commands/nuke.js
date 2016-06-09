// Nuke command
module.exports = {
  message_regex: /^.nuke/,
  response: function () {
    return "https://not-an-aardvark.github.io/reddit-thread-nuke/";
  }
};
