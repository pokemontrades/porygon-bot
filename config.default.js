module.exports = {
  debug: false,
  irc: {
      enabled: true,
      server: "irc.synirc.net",
      port: 6669,
      secure : false,
      selfSigned : false,
      certExpired : false,
      nick: "porygon-bot",
      userName: "porygon-bot",
      realName: "Porygon",
      password: "super-secret-password",
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
      }
  },
  db: {
    enabled: true,
    host: "http://localhost",
    port: 3306,
    user: "mysql",
    password: "super-secret-password",
    database: "porygon_bot"
  },
  reddit: {
    enabled: true,
    client_id: 'aaa',
    client_secret: 'bbb',
    refresh_token: 'ccc', // Scope: modposts privatemessages read submit wikiedit wikiread
    user_agent: 'Porygon IRC Helper',
    //For usernote module, if enabled:
    usernoteConfig: {
      defaultSubreddit: "yoursubreddit",
      channelCacheMaxLength: 50,
      channelPermissions: {
        "#trusteduserchannel": true,                   //A 'true' value allows access to any usernotes the bot has access to.
        "#otherchannel": ["yoursubreddit","othersub"], //If you wish to restrict access, an array can be used to specify which
        "#yetanotherchannel": ["ASingleSub"]           //subreddits can be accessed in a given channel.
      }
    }
  }
};
