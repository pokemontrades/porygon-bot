'use strict';
var NodeCache = require('node-cache');
var _ = require('lodash');
var moment = require('moment');
const Promise = require('bluebird');
var r = require('../services/reddit.js');
var parseArgs = require('minimist');
var cache = new NodeCache({stdTTL: 900});
const removedNoteCache = [];
const warningsToWords = {
  none: ['blue', 'none'],
  gooduser: ['green', 'misc', 'misc.', 'miscellaneous'],
  spamwatch: ['pink', 'sketchy'],
  spamwarn: ['purple', 'flair', 'fc'],
  abusewarn: ['yellow', 'orange', 'minor warning', 'warn', 'warning'],
  ban: ['red', 'major warning', 'tempban', 'light red'],
  permban: ['brown', 'dark red', 'permaban', 'permanent ban'],
  botban: ['black', 'old', 'general']
};
let warningTypes = _.keys(warningsToWords);
let usageForNerds = 'Usage: .tag [show | add | append] < -n|--note> "<note>" < --user <username> | /u/<username> >\
 [--sub <subreddit> | /r/<subreddit>] [--url <url> | https://<url>] [--color <color>] [--refresh | --refresh-cache]';
let usageForRegularPeople = 'To view /u/username\'s tags on /r/pokemontrades: .tag /u/username\n\
To view /u/username\'s tags on /r/somewhere_else: .tag /u/username /r/somewhere_else\n\
To add a tag: .tag add --note "Note text goes here" https://reddit.com/some_link\n\
To add a red tag: .tag add --note "Note text goes here" --color red https://reddit.com/some_link\n\
To view advanced options: .tag options';

var wordsToWarnings = {};
for (let i = 0; i < warningTypes.length; i++) {
  warningsToWords[warningTypes[i]].forEach(function (word) {
    wordsToWarnings[word] = warningTypes[i];
  });
}

module.exports = {
  message_regex: /^.(?:usernote|tag)(?: (.*)|$)/,
  allow: function ({isPM, isAuthenticated, isMod}) {
    return !isPM && isAuthenticated && isMod;
  },
  response: function ({message_match, author_match}) {
    /* Split into words, but keep quoted blocks together. Also parse reddit usernames and correctly.
    e.g. '--option1 word --option2 "quoted block" otherword /u/someone /r/some_sub https://reddit.com/blah/'
    --> ['--option1', 'word', '--option2', 'quoted block', 'otherword', '--user', 'someone', '--subreddit', 'some_sub', '--link', 'reddit.com/blah/'] */
    if (!message_match[1]) {
      return usageForRegularPeople;
    }
    let splitIntoWords = /(http(?:s)?:\/\/)|(\/u\/)|(\/r\/)|([^\s"]+)|(?:"((\\")?(?:[^"\\]|\\\\|\\")*)")+/g;
    if (message_match[1].replace(splitIntoWords, '').trim()) {
      throw {error_message: 'Error: invalid string.'};
    }
    let preparsedArgs = message_match[1].match(splitIntoWords).map(function (str) {
      return str.replace(/\\\\/g, '\\').replace(/\\"/g, '"').replace(/^"(.*)"$/, '$1').replace(/^\/?u\/$/, '--user')
        .replace(/^\/?r\/$/, '--subreddit').replace(/^http(s?):\/\/$/, '--link');
    });
    let parseSettings = {
      default: {type: 'yellow'},
      boolean: ['refresh', 'help'],
      alias: {
        sub: 'subreddit', s: 'subreddit', text: 'note', n: 'note', u: 'user', color: 'type', c: 'type', warning: 'type',
        url: 'link', l: 'link', 'refresh-cache': 'refresh'
      }
    };
    let args = parseArgs(preparsedArgs, parseSettings);
    let command = args._.length ? args._[0].toLowerCase() : 'show';
    args.subreddit = args.link || args.subreddit ? args.subreddit : 'pokemontrades';
    if (command === 'help' || args.help) {
      return usageForRegularPeople;
    }
    if (command === 'show') {
      if (!args.user) {
        throw {error_message: 'Error: No user provided. For help, try `.tag help`.'};
      }
      return getNotes(args.subreddit, {refresh: args.refresh}).then(function (parsed) {
        let notes = _.find(parsed.notes, function (obj, name) {
          if (name.toLowerCase() === args.user.toLowerCase()) {
            args.user = name;
            return true;
          }
        });
        if (notes) {
          return [`Notes on /u/${args.user} on /r/${args.subreddit}:`].concat(
            notes.ns.map((note, i) => `(${i}) ${formatNote(note, args.subreddit)}`)
          );
        }
        return `No notes found for /u/${args.user} on /r/${args.subreddit}.`;
      }).catch(handleErrors);
    } else if (['add', 'create', 'append'].indexOf(command) !== -1) {
      let warning = wordsToWarnings[args.type];
      if (!warning) {
        throw {error_message: `Error: Unknown note type '${args.type}'`};
      }
      if (!args.note) {
        throw {error_message: 'Error: Missing note text.'};
      }
      return getMissingInfo(args).then(props => addNote({
          mod: author_match[0],
          user: props.user,
          subreddit: props.subreddit,
          note: args.note,
          warning,
          link: props.link,
          append: command === 'append' ? -1 : 0
        }).then(result => [`Successfully added note on /u/${props.user}:`, `${formatNote(result, props.subreddit)}`])
      ).catch(handleErrors);
    } else if (['delete', 'rm', 'remove'].indexOf(command) !== -1) {
      if (!args.user) {
        throw {error_message: 'Error: No user provided'};
      }
      args.subreddit = args.subreddit || 'pokemontrades';
      if (!_.isNumber(args._[1])) {
        throw {error_message: 'No index number provided. You must provide the index number of the note to remove.'};
      }
      return removeNote({user: args.user, subreddit: args.subreddit, index: args._[1], requester: author_match[1]}).then(note => {
        return ['Successfully deleted the following note:', formatNote(note, args.subreddit), 'To undo this action, use ".tag undo-delete"'];
      }).catch(handleErrors);
    } else if (command === 'undo-delete') {
      const newNote = removedNoteCache.pop();
      return addNote(newNote).then(result => (
        [`Successfully recreated note on /u/${newNote.user} on /r/${newNote.subreddit}:`, formatNote(result, newNote.subreddit)]
      )).catch(err => {
        removedNoteCache.push(newNote);
        handleErrors(err);
      });
    } else if (command === 'options') {
      return usageForNerds;
    } else {
      throw {error_message: `Error: Unrecognized command "${command}". For help, use ".tag help".`};
    }
  }
};
function decompressBlob (blob) {
  return JSON.parse(require('zlib').inflateSync(new Buffer(blob, 'base64')));
}
function compressBlob (notesObject) {
  return require('zlib').deflateSync(new Buffer(JSON.stringify(notesObject))).toString('base64');
}
function getNotes (subreddit, {refresh = false} = {}) {
  const cached_notes = cache.get(subreddit);
  if (cached_notes && !refresh) {
    return Promise.resolve(cached_notes);
  }
  return r.get_subreddit(subreddit).get_wiki_page('usernotes').content_md.then(JSON.parse).then(pageObject => {
    const parsed = _(pageObject).assign({notes: decompressBlob(pageObject.blob)}).omit('blob').value();
    cache.set(subreddit, parsed);
    return parsed;
  });
}
function parseUrl (url) {
  const urlParser = /^(?:(?:http(?:s?):\/\/)?(?:\w*\.)?reddit.com)?\/(?:r\/(\w{1,21})\/comments\/(\w*)(?:\/[\w-]*\/(\w*))?)|(?:message\/messages\/(\w*))/;
  const matched = url.match(urlParser);
  if (!matched) {
    throw {error_message: 'Error: The provided URL is invalid.'};
  }
  return {subreddit: matched[1], submissionId: matched[2], commentId: matched[3], messageId: matched[4]};
}
function getMissingInfo ({user: providedUser, subreddit: providedSubreddit, link: providedUrl}) {
  /* If no URL was provided, simply use the information that was given. However, fetch the user's information
  on reddit, because their name might have been capitalized incorrectly and it's important that we get the
  correct capitalization. */
  if (!providedUrl) {
    if (!providedUser) {
      throw {error_message: 'Error: Either a user or a URL is required.'};
    }
    if (!providedSubreddit) {
      throw {error_message: 'Error: Either a subreddit or a URL is required.'};
    }
    return Promise.props({user: r.get_user(providedUser).fetch().name, subreddit: providedSubreddit});
  }
  // If a URL was provided, fetch the information as necessary.
  const parsedUrl = parseUrl(providedUrl);
  let link, contentObject;
  if (parsedUrl.messageId) {
    contentObject = r.get_message(parsedUrl.messageId);
    link = `m,${parsedUrl.messageId}`;
  } else if (parsedUrl.commentId) {
    contentObject = r.get_comment(parsedUrl.commentId);
    link = `l,${parsedUrl.submissionId},${parsedUrl.commentId}`;
  } else {
    contentObject = r.get_submission(parsedUrl.submissionId);
    link = `l,${parsedUrl.submissionId}`;
  }
  const user = contentObject.author.name.then(name => {
    if (providedUser) {
      // If the provided user is the author of the content, use the username from the content
      if (name.toLowerCase() === providedUser.toLowerCase()) {
        return name;
      }
      // Otherwise, get the provided user's profile page to make sure the capitalization is correct.
      return r.get_user(providedUser).fetch().name.catchReturn(providedUser);
    }
    if (name === '[deleted]') {
      throw {error_message: 'Error: The linked item was deleted, and no username was provided.'};
    }
    return name;
  });
  // The subreddit is only used as part of a URL, so capitalization doesn't matter.
  const subreddit = providedSubreddit || parsedUrl.subreddit || contentObject.subreddit.display_name;
  return Promise.props({user, subreddit, link});
}
function addNote ({mod, user, subreddit, note, warning = 'abusewarn', link, index = 0, timestamp = moment().unix()}) {
  return getNotes(subreddit, {refresh: true}).then(parsed => {
    _.merge(parsed.notes, {[user]: {ns: []}});
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
}
function removeNote ({user, subreddit, index, requester}) {
  return getNotes(subreddit, {refresh: true}).then(parsed => {
    const name = _.findKey(parsed.notes, (obj, username) => username.toLowerCase() === user.toLowerCase());
    if (name === -1 || parsed.notes[name].ns.length < index) {
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
      removedNoteCache.push({
        mod: parsed.constants.users[removedNote.m],
        user,
        subreddit,
        note: removedNote.n,
        warning: parsed.constants.warnings[removedNote.w],
        link: removedNote.l,
        index,
        timestamp: removedNote.t
      });
      cache.set(subreddit, parsed);
      return removedNote;
    });
  });
}
function formatNote (note, subreddit) {
  let parsed = cache.get(subreddit);
  const color = warningsToWords[parsed.constants.warnings[note.w]][0];
  const author = parsed.constants.users[note.m];
  const timestamp = moment.unix(note.t).fromNow();
  let link;
  if (note.l) {
    if (note.l.charAt(0) === 'm') {
      link = `reddit.com/message/messages/${note.l.slice(2)}`;
    } else if (note.l.slice(2).includes(',')) {
      link = `reddit.com/comments/${note.l.slice(2).replace(/,/, '/-/')}`;
    } else {
      link = `reddit.com/${note.l.slice(2)}`;
    }
  }
  const content = note.n;
  return `"${content}" (${timestamp}, by ${author}${link ? `, on link ${link} ` : ''}, colored ${color})`;
}
function handleErrors (err) {
  throw _.assign(err, {
    error_message: err.error_message || (err.statusCode ? `Error: Reddit sent status code ${err.statusCode}.` : 'An unknown error occured.')
  });
}
