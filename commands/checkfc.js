var sha1 = data => require('crypto').createHash('sha1').update(Buffer(data)).digest();
function validateFC (fc) {
  fc = fc.replace(/-/g, '');
  return /^\d{12}$/.test(fc) && sha1(new Uint32Array([fc]).buffer)[0] >> 1 === fc / Math.pow(2, 32) >> 0;
}
module.exports = {
  message_regex: /^\.checkfc (\d{4}-\d{4}-\d{4})/,
  response: function ({message_match}) {
    return 'Friend code: ' + message_match[1] + ' - Valid? ' + (validateFC(message_match[1]) ? 'YES' : 'NO');
  }
};
