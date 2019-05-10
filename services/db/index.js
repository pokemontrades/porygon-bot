const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const path = require('path');
const models = require('./models');

const db = {
    connected: false,
    modules: {},
    getUserInfo,
    listModules,
    setUp,
    models: {}
};

module.exports = db;

function getUserInfo(nick, callback) {
    return db.models.Alias.findOne({where: {Alias: {[Op.eq]: nick}}, include: [db.models.User]})
        .then((result) => result ? result.get({plain: true}) : Promise.reject(`No user/alias found for ${nick}`))
        .then(({UserID, Alias, isNick, User: {Timezone, MainNick}}) => callback({UserID, Alias, isNick, Timezone, MainNick}))
        .catch((err) => {
            console.log(`Error updating timezone: ${err}`);
            Promise.reject(err);
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
    const sequelize = new Sequelize(config.database, config.user, config.password, {
        host: config.host,
        port: config.port,
        dialect: config.type || 'mysql',
        logging: false,

        // SQLite only
        storage: path.join(__dirname, '..', '..', 'database.sqlite'),
        operatorsAliases: false
    });

    db.models = models(sequelize);

    sequelize.sync()
        .then(function() {

        db.connected = true;

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