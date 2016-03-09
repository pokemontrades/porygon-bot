var db = require('../services/db');
var mysql = require('promise-mysql');

module.exports = {
    db_required: true,
    message_regex: /^.settimezone\s*(\S*)?$/,
    response: function ({message_match, author_match, isAuthenticated}) {
        if (!isAuthenticated) {
            return "You must be authenticated to use this command.";
        }
        return db.getMain(author_match[0], function(results) {
            if (!message_match[1]) {
                return "Usage: .settimezone <offset>, e.g. .settimezone -03:30";
            }
            if (!results) {
                return "Slight problem: I don't know who you are...";
            }
            var timezone = timezoneToInt(message_match[1]);
            if (timezone === undefined) {
                return "I'm not sure what time zone that's supposed to be.";
            }
            return db.conn.query('UPDATE User SET timezone = ? WHERE UserID=?',
                [timezone,results.UserID]).then(function(result) {
                    return "Timezone updated successfully!";
                }).catch(function(err) {
                    console.log(err);
                });
        });
    }
}

function timezoneToInt(str) {
    var matches = (/(-|\+)?(\d+)((\:|\.)(\d+))?/).exec(str);
    if (!matches) {
        if ((/(GMT|UTC)\s*/).exec(str)) {
            return 0;
        } else {
            return undefined;
        }
    }
    var sign = matches[1]
    var hour = parseInt(matches[2]);
    var min = parseInt(matches[5]);
    var separator = matches[4];
    var result;
    if (separator === '.') {
        result = (hour*60)+parseFloat('0.'+matches[5])*60;
    } else {
        result = (hour*60)+(min ? min : 0);
    }
    return (sign === '-' ? -1 * result : result);
}
