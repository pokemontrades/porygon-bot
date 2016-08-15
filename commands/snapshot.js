// Snapshot command
module.exports = {
  message_regex: /^\.snapshot/,
  response: function () {
    return "https://not-an-aardvark.github.io/reddit-thread-snapshots/";
  }
};
