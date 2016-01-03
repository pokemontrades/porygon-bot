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
  channels: ["#ircroom"],
  friendly: ["coolperson1", "coolperson2"],
  reddit_client_id: 'aaa',
  reddit_client_secret: 'bbb',
  reddit_refresh_token: 'ccc', // Scope: privatemessages read wikiedit wikiread
  reddit_user_agent: 'Porygon IRC Helper'
};
