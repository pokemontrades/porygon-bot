'use strict';
var NodeCache = require('node-cache');
var _ = require('lodash');
var moment = require('moment');
var pako = require('pako');
var reddit = require('../services/reddit.js');
var parseArgs = require('minimist');
var cache = new NodeCache({stdTTL: 900});
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
      boolean: ['refresh-cache', 'help'],
      alias: {
        sub: 'subreddit', s: 'subreddit', text: 'note', n: 'note', u: 'user', color: 'type', c: 'type', warning: 'type',
        url: 'link', l: 'link', refresh: 'refresh-cache'
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
      return getNotes(args.subreddit, args['refresh-cache']).then(function (parsed) {
        let notes = _.find(parsed.notes, function (obj, name) {
          if (name.toLowerCase() === args.user.toLowerCase()) {
            args.user = name;
            return true;
          }
        });
        if (notes) {
          return 'Notes on /u/' + args.user + ': ' + notes.ns.map((note, index) => (prettyPrintNote(note, args.subreddit, index))).join(', ');
        }
        return 'No notes found for /u/' + args.user + ' on /r/' + args.subreddit + '.';
      });
    }
    if (command === 'add' || command === 'create' || command === 'append') {
      let warning = wordsToWarnings[args.type];
      if (!warning) {
        throw {error_message: "Error: Unknown note type '" + args.type + "'"};
      }
      if (!args.note) {
        throw {error_message: 'Error: Missing note text.'};
      }
      return getMissingInfo(args.user, args.subreddit, args.link).then(function (data) {
        return addNote(author_match[0], data[0], data[1], args.note, warning, data[2], command === 'append').then(function (result) {
          return 'Successfully added note on ' + data[0] + ': ' + prettyPrintNote(result, data[1]);
        });
      });
    }
    if (command === 'options') {
      return usageForNerds;
    }
  }
};

function decompress (blob) {
  var inflate = new pako.Inflate({to: 'string'});
  inflate.push(new Buffer(blob, 'base64').toString('binary'));
  return JSON.parse(inflate.result);
}
function compress (notesObject) {
  var deflate = new pako.Deflate({to: 'string'});
  deflate.push(JSON.stringify(notesObject), true);
  return (new Buffer(deflate.result.toString(), 'binary')).toString('base64');
}
function getNotes (subreddit, ignore_cache) {
  let cached_notes = cache.get(subreddit);
  if (cached_notes && !ignore_cache) {
    return Promise.resolve(cached_notes);
  }
  return reddit.getWikiPage(subreddit, 'usernotes').then(function (compressed_notes) {
    let pageObject = JSON.parse(compressed_notes);
    let parsed = _(pageObject).assign({notes: decompress(pageObject.blob)}).omit('blob').value();
    cache.set(subreddit, parsed);
    return parsed;
  });
}
function getMissingInfo (user, subreddit, url) {
  let fetchUser, fetchSubreddit, formatted_link;
  if (url) {
    let parsed_url = url.match(/^(?:(?:http(?:s?):\/\/)?(?:\w*\.)?reddit.com)?\/(?:r\/(\w{1,21})\/comments\/(\w*)\/\w*\/(\w*)?)|(?:message\/messages\/(\w*))/);
    if (!parsed_url) {
      throw {error_message: 'Error: The provided URL is invalid.'};
    }
    if (parsed_url[4]) {
      let fetchObject = reddit.getItemById('t4_' + parsed_url[4]);
      fetchUser =  fetchObject.then(function (tree) {
        return !user || tree.data.author.toLowerCase() === user.toLowerCase() ? tree.data.author : reddit.getCorrectUsername(user);
      });
      fetchSubreddit = subreddit || fetchObject.then(tree => (tree.data.subreddit));
      formatted_link = 'm,' + parsed_url[4];
    } else {
      fetchUser = reddit.getItemById(parsed_url[3] ? 't1_' + parsed_url[3] : 't3_' + parsed_url[2]).then(function (response) {
        if (response.data.author === '[deleted]') {
          if (user) {
            return reddit.getCorrectUsername(user);
          }
          throw {error_message: 'Error: The linked item was deleted, and no username was provided.'};
        }
        return response.data.author;
      });
      fetchSubreddit = subreddit || parsed_url[1];
      formatted_link = 'l,' + parsed_url[2] + (parsed_url[3] ? ',' + parsed_url[3] : '');
    }
  } else {
    if (!user) {
      throw {error_message: 'Error: Either a user or a URL is requred.'};
    }
    if (!subreddit) {
      throw {error_message: 'Error: Either a subreddit or a URL is required.'};
    }
    fetchUser = reddit.getCorrectUsername(user);
    fetchSubreddit = subreddit;
  }
  return Promise.all([fetchUser, fetchSubreddit, formatted_link]);
}
function addNote (modname, user, subreddit, noteText, warning, link_id, add_to_end) {
  return getNotes(subreddit, true).then(function (parsed) {
    let mods = parsed.constants.users;
    let warnings = parsed.constants.warnings;
    let notes = parsed.notes;
    if (!notes[user]) {
      notes[user] = {ns: []};
    }
    if (mods.indexOf(modname) === -1) {
      mods.push(modname);
    }
    if (warnings.indexOf(warning) === -1) {
      warnings.push(warning);
    }
    var newNote = {n: noteText, t: moment().unix(), m: mods.indexOf(modname), l: link_id, w: warnings.indexOf(warning)};
    notes[user].ns[add_to_end ? 'push' : 'unshift'](newNote);
    let newPageObject = _(parsed).assign({blob: compress(notes)}).omit('notes').value();
    return reddit.editWikiPage(subreddit, 'usernotes', JSON.stringify(newPageObject), modname + ': Added a note on /u/' + user).then(function () {
      cache.set(subreddit, parsed);
      return newNote;
    });
  });
}
function prettyPrintNote (note, subreddit, index) {
  let parsed = cache.get(subreddit);
  return (index ? '(' + (index + 1) + ') ' : '') + _.capitalize(warningsToWords[parsed.constants.warnings[note.w]][0]) + ' note by ' +
    parsed.constants.users[note.m] + ' at ' + moment.unix(note.t).utc().format("YYYY-MM-DD HH:mm:ss UTC") + (note.l ? ' on link https://reddit.com' +
    (note.l.charAt(0) === 'l' ? ('/r/' + subreddit + '/comments/' + note.l.slice(2).replace(/,/g,'/-/')) : '/message/messages/' + note.l.slice(2)) : '') + ' : "' + note.n + '"';
}
