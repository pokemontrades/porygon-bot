var sha1 = require('node-sha1');
function validateFC (fc) {
  fc = fc.replace(/-/g, '');
  if (!fc.match(/^\d{12}$/) || fc >= Math.pow(2, 39)) {
    return false;
  }
  var bytes = new Buffer(4);
  bytes.writeUInt32LE(fc % Math.pow(2, 32));
  return parseInt(sha1(bytes).slice(0, 2), 16) >> 1 === Math.floor(fc / Math.pow(2, 32));
}
module.exports = {
  message_regex: /^.checkfc (\d{4}-\d{4}-\d{4})/,
  response: function ({message_match}) {
    return 'Friend code: ' + message_match[1] + ' - Valid? ' + (validateFC(message_match[1]) ? 'YES' : 'NO');
  }
};
