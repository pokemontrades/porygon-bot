module.exports = {
  server: "irc.synirc.net",
  port: 6669,
  secure : false,
  selfSigned : false,
  certExpired : false,
  nick: "porygon-bot",
  userName: "porygon-bot",
  realName: "Porygon",
  password: "super-secret-password",
  disable_db: false,
  dbHost: "http://localhost",
  dbUser: "mysql",
  dbPassword: "super-secret-password",
  database: "porygon_bot",
  channels: {
    '#ircroom1': true, // allow all commands in this room
    '#ircroom2': false, // don't allow any commands in this room
    '#ircroom3': /check(ball|fc)/, // Only allow commands that match a given regex in this room
    '#ircroom4': 'highfive', // Only allow one specified command in this room
    '#ircroom5': ['messages', 'highfive'], // Only allow these specific commands in this room
    '#ircroom6': function (commandName) { // Only allow commands for which a specified function returns a truthy value
      // some code goes here
      return commandName;
    }
  },
  tasks: {
    '#ircroom1': true // allow all tasks in this room
    // etc.
  },
  friendly: ["coolperson1", "coolperson2"],
  reddit_client_id: 'aaa',
  reddit_client_secret: 'bbb',
  reddit_refresh_token: 'ccc', // Scope: privatemessages read wikiedit wikiread
  reddit_user_agent: 'Porygon IRC Helper'
};
