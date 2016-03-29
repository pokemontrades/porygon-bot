exports.conn = null;
exports.modules = {};
exports.getMain = function(nick, callback) {
    return exports.conn.query('SELECT * FROM User U JOIN Nick N ON U.UserID = N.UserID WHERE N.Nickname LIKE ?',
        ['%'+nick+'%']).then(function(result) {
            return callback(result[0]);
        }).catch(function(err) {
            console.log(err);
        });
};
exports.listModules = function() {
    var module_list_keys = {};
    var type_list = Object.keys(exports.modules);
    for (var current_type = 0; current_type < type_list.length; current_type++) {
        var modules = Object.keys(exports.modules[type_list[current_type]]);
        for (var current_module = 0; current_module < modules.length; current_module++) {
            module_list_keys[modules[current_module]] = true;
        }
    }
    return Object.keys(module_list_keys);
};
