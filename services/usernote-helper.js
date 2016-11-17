'use strict';
const _ = require('lodash');
const moment = require('moment');
const r = require('./reddit');
const cache = new (require('node-cache'))({stdTTL: 900});

var moduleConfig = require('../config.js').usernoteConfig;

module.exports = {
  getNotes (subreddit, fromChannel, {refresh = false} = {}) {
    if (typeof subreddit !== 'string') {
      throw {error_message: 'Error: No subreddit provided.'};
    }
    checkAccess({channel: fromChannel, subreddit: subreddit});
    const cached_notes = cache.get(subreddit);
    if (cached_notes && !refresh) {
      return Promise.resolve(cached_notes);
    }
    return r.get_subreddit(subreddit).get_wiki_page('usernotes').content_md.then(JSON.parse).then(pageObject => {
      const parsed = _.assign(_.omit(pageObject, 'blob'), {notes: decompressBlob(pageObject.blob)});
      cache.set(subreddit, parsed);
      return parsed;
    });
  },
  getNotesSync(subreddit) {
    return cache.get(subreddit);
  },
  addNote ({mod, user, subreddit, note, warning = 'abusewarn', link, index, timestamp = moment().unix(), fromChannel}) {
    checkAccess({channel: fromChannel, subreddit: subreddit});
    return module.exports.getNotes(subreddit, fromChannel, {refresh: true}).then(parsed => {
      _.merge(parsed.notes, {[user]: {ns: []}});
      index = index === undefined ? parsed.notes[user].ns.length : index;
      const newNote = {
        n: note,
        t: timestamp,
        m: (parsed.constants.users.indexOf(mod) + 1 || parsed.constants.users.push(mod)) - 1,
        w: (parsed.constants.warnings.indexOf(warning) + 1 || parsed.constants.warnings.push(warning)) - 1,
        l: link
      };
      parsed.notes[user].ns.splice(index, 0, newNote);
      return r.get_subreddit(subreddit).get_wiki_page('usernotes').edit({
        text: JSON.stringify(_(parsed).assign({blob: compressBlob(parsed.notes)}).omit('notes').value()),
        reason: `Added a note on /u/${user} (on behalf of ${mod})`
      }).then(() => {
        cache.set(subreddit, parsed);
        return newNote;
      });
    });
  },

  removeNote ({user, subreddit, index, requester, fromChannel}) {
    checkAccess({channel: fromChannel, subreddit: subreddit});
    return module.exports.getNotes(subreddit, fromChannel, {refresh: true}).then(parsed => {
      const name = _.findKey(parsed.notes, (obj, username) => username.toLowerCase() === user.toLowerCase());
      if (!name || !_.isInteger(index) || !_.inRange(index, parsed.notes[name].ns.length)) {
        throw {error_message: 'Error: That note was not found.'};
      }
      const removedNote = parsed.notes[name].ns.splice(index, 1)[0];
      if (!parsed.notes[name].ns.length) {
        delete parsed.notes[name];
      }
      return r.get_subreddit(subreddit).get_wiki_page('usernotes').edit({
        text: JSON.stringify(_(parsed).assign({blob: compressBlob(parsed.notes)}).omit('notes').value()),
        reason: `Removed a note on /u/${user}${requester ? `(on behalf of ${requester})` : ''}`
      }).then(() => {
        cache.set(subreddit, parsed);
        return {
          m: removedNote.m,
          mod: parsed.constants.users[removedNote.m],
          user,
          subreddit,
          n: removedNote.n,
          note: removedNote.n,
          w: removedNote.w,
          warning: parsed.constants.warnings[removedNote.w],
          l: removedNote.l,
          link: removedNote.l,
          index,
          t: removedNote.t,
          timestamp: removedNote.t,
          fromChannel: fromChannel
        };
      });
    });
  }
};

function checkAccess ({channel, subreddit}) {
  if (channel === null) {

    // The channel should only be `null` when Porygon-Bot adds a note of its own accord (e.g. from the spam task.)
    // It bypasses channel permissions.
    return true;
  }

  //Access is automatically granted if there is no channelPermissions block.
  if (!moduleConfig || !moduleConfig.channelPermissions) return true;

  //First check handles conditions where a channelPermissons block exists, but the entry for the channel either does not or is set to 'false'.
  //Second check results in permission being granted if it set to 'true' or if the given subreddit is in the array of allowed subs for the channel.
  if (moduleConfig.channelPermissions[channel] && (_.isBoolean(moduleConfig.channelPermissions[channel]) || moduleConfig.channelPermissions[channel].findIndex(sub => sub.toLowerCase() === subreddit.toLowerCase()) > -1)) {
    return true;
  }

  throw {error_message: 'Access denied.'};
}

function decompressBlob (blob) {
  return JSON.parse(require('zlib').inflateSync(Buffer.from(blob, 'base64')));
}

function compressBlob (notesObject) {
  return require('zlib').deflateSync(Buffer.from(JSON.stringify(notesObject))).toString('base64');
}
