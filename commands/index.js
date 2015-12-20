// Export the names of all files in the current directory. This allows new files to be added without having to explicitly list them in bot.js.
require('fs').readdirSync(__dirname + '/').forEach(function (file) {
  if (file.match(/\.js$/) !== null && file !== 'index.js') {
    var name = file.replace('.js', '');
    module.exports[name] = require('./' + file);
  }
});
