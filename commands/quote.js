'use strict';
const db = require('../services/db');

module.exports = {
  db_required: true,
  message_regex: /^.(?:quote)(?: ([^ ]+)|$)(?: (.+)|$)$/,
  allow: ({ isMod, isAuthenticated, isPM }) => isMod && isAuthenticated && !isPM,
  response({ message_match: [, command, quote], author_match: [author], channel }) {
    if (!command) {
      command = 'get';
    }
    switch (command.toLowerCase()) {
      case 'add':
      case 'store':
        return add(author, channel, quote);
      case 'get':
        return get(channel, quote);
      case 'search':
        return search(channel, quote);
      case 'help':
        return [
          '`.quote add \'quote\'` to add a new quote',
          '`.quote get \'id\'` to get a specific quote, or omit id for a random one',
          '`.quote search \'term\'` to search for quote with a searchterm'
        ];
      default:
        return 'Command to store/retrieve quotes. Use `.quote help` for detailed instructions.';
    }
  }
};

function add(author, channel, quote) {
  if (!quote) {
    return 'No quote to store.';
  }
  const addQuery = 'INSERT INTO `Quote` (`Author`, `Message`, `Chan`) VALUES (?, ?, ?);';
  return db.conn
    .query(addQuery, [author, quote, channel])
    .then(created => `Storing quote '${quote}' from '${author}' on '${channel}', with id '${created.insertId}'`);
}

function get(channel, quote) {
  if (quote) {
    const getQuery = 'SELECT * FROM Quote WHERE Quote.ID = ?';
    return db.conn
      .query(getQuery, [quote]).get(0)
      .then(result => {
        return result ? `${result.Message} (submitted by ${result.Author})` : `No quote with ID ${quote}`;
      });
  }
  const randomQuery = 'SELECT * FROM Quote WHERE Quote.Chan = ? ORDER BY RAND() LIMIT 1';
  return db.conn
    .query(randomQuery, [channel]).get(0)
    .then(result => {
      return result ? `${result.Message} (submitted by ${result.Author})` : 'No quotes currently stored';
    });
}

function search(channel, quote) {
  if (!quote) {
    return 'No term to search for.';
  }
  const searchQuery = 'SELECT * FROM Quote WHERE Quote.Chan = ? AND Quote.Message LIKE ? ORDER BY RAND() LIMIT 1';
  return db.conn
    .query(searchQuery, [channel, `%${quote}%`])
    .then(results => {
      if (!results || results.length === 0) {
        return `No results for ${quote}`;
      } else {
        return results.map(result => `${result.Message} (submitted by ${result.Author}) (id ${result.id})`);
      }
    });
}
