const mysql = require('promise-mysql');

const db = {
    conn: null,
    modules: {},
    getUserInfo,
    listModules,
    setUp
};

module.exports = db;

function getUserInfo(nick, callback) {
    return module.exports.conn.query('SELECT * FROM User U JOIN Alias A ON U.UserID = A.UserID WHERE A.Alias = ?',
        [nick]).then(function(result) {
            return callback(result[0]);
        }).catch(function(err) {
            console.log(err);
        });
}

function listModules() {
    var module_list_keys = {};
    var type_list = Object.keys(module.exports.modules);
    for (var current_type = 0; current_type < type_list.length; current_type++) {
        var modules = Object.keys(module.exports.modules[type_list[current_type]]);
        for (var current_module = 0; current_module < modules.length; current_module++) {
            module_list_keys[modules[current_module]] = true;
        }
    }
    return Object.keys(module_list_keys);
}

function setUp(config, commands) {
	mysql.createConnection({
		host: config.dbHost,
		user: config.dbUser,
		port: config.dbPort,
		password: config.dbPassword,
		database: config.database,
		timezone: 'Etc/UTC'
	}).then(function(conn) {

        db.conn = conn;

		Object.keys(db.modules).forEach(function(event) {
			Object.keys(db.modules[event]).forEach(function(name) {
				if (commands[event] === undefined) {
					commands[event] = {};
				}
				commands[event][name] = db.modules[event][name];
			});
		});

	}).catch(function(error) {
		console.log("An error occurred while establishing a connection to the database. Details can be found below:\n"+error+"\nThe following modules, which require database connectivity, have been disabled: ["+db.listModules().join(", ")+"]");
	});
}