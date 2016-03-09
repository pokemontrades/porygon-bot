// Export the names of all files in the current directory. This allows new files to be added without having to explicitly list them in bot.js.
var db = require('../services/db');
require('fs').readdirSync(__dirname + '/').forEach(function (file) {
  if (file.match(/\.js$/) !== null && file !== 'index.js') {
    var name = file.replace('.js', '');
    var events = [];
    var include = require('./' + file);
    if (include.events) {
        events = include.events;
    } else {
        events = ['message'];
    }
    if (include.db_required == true) {
      events.forEach(function(event) {
        if (db.modules[event] === undefined) {
          db.modules[event] = {};
        }
        db.modules[event][name] = include;
        //console.log("Added "+name+" to the list of '"+event+"' db modules");
      });
    } else {
      events.forEach(function(event) {
          if (module.exports[event] === undefined) {
            module.exports[event] = {};
          }
          module.exports[event][name] = include;
          //console.log("Added "+name+" to the list of '"+event+"' NON-db modules");
      });
    }
  }
});
