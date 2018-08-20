'use strict';
const r = require('../services/reddit');
if (!r) {
  return;
}

var _ = require('lodash');
var moment = require('moment');
const Promise = require('bluebird');
var parseArgs = require('minimist');
try {
  var moduleConfig = require('../config.js').reddit.usernoteConfig;
  if (!moduleConfig.channelPermissions) {
    console.log("The usernote module config file does not contain channelPermissions section. Usernotes may be managed for any subreddit on any channel the module is enabled in.");
  }
} catch(err) {
  console.log("No config file found for usernote module. Usernotes may be managed for any subreddit on any channel the module is enabled in.");
}
const usernoteHelper = require('../services/usernote-helper');
const removedNoteCache = Object.create(null);
const channelCacheMaxLength = moduleConfig && moduleConfig.channelCacheMaxLength ? moduleConfig.channelCacheMaxLength : 50;
const warningsToWords = {
  none: ['none', 'uncolored'],
  gooduser: ['light green'],
  misc: ['blue', 'green', 'misc', 'misc.', 'miscellaneous'],
  spamwatch: ['pink', 'sketchy'],
  spamwarn: ['purple', 'flair', 'fc'],
  abusewarn: ['yellow', 'orange', 'minor warning', 'warn', 'warning'],
  ban: ['red', 'major warning', 'tempban', 'light red'],
  permban: ['brown', 'dark red', 'permaban', 'permanent ban'],
  botban: ['dark gray','dark grey'],
  old: ['black', 'old', 'general']
};
let warningTypes = _.keys(warningsToWords);
let usageForNerds = 'Usage: .tag [show | add | append] < -n|--note> "<note>" < --user <username> | /u/<username> >\
 [--sub <subreddit> | /r/<subreddit>] [--url <url> | https://<url>] [--color <color>] [--refresh | --refresh-cache] [--all]';
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
  message_regex: /^\.(?:usernote|tag|tags)(?: (.*)|$)/,
  allow: function ({isPM, isAuthenticated, isMod}) {
    return !isPM && isAuthenticated && isMod;
  },
  response: function ({message_match, author_match, channel}) {
    /* Split into words, but keep quoted blocks together. Also parse reddit usernames and correctly.
    e.g. '--option1 word --option2 "quoted block" otherword /u/someone /r/some_sub https://reddit.com/blah/'
    --> ['--option1', 'word', '--option2', 'quoted block', 'otherword', '--user', 'someone', '--subreddit', 'some_sub', '--link', 'reddit.com/blah/'] */
    if (!message_match[1]) {
      return usageForRegularPeople;
    }
    let splitIntoWords = /([^\s"]+)|(?:"((\\")?(?:[^"\\]|\\\\|\\")*)")+/g;
    if (message_match[1].replace(splitIntoWords, '').trim()) {
      throw {error_message: 'Error: invalid string.'};
    }
    let preparsedArgs = message_match[1].match(splitIntoWords).map(function (str) {
      return str
        .replace(/\\\\/g, '\\')
        .replace(/\\"/g, '"')
        .replace(/^\/?u\//, '--user=')
        .replace(/^\/?r\//, '--subreddit=')
        .replace(/^http(s?):\/\//, '--link=')
        .replace(/^"(.*)"$/, '$1');
    });
    let parseSettings = {
      default: {type: 'yellow'},
      string: ['subreddit', 'note', 'user', 'type', 'link'],
      boolean: ['refresh', 'help', 'all'],
      alias: {
        sub: 'subreddit', s: 'subreddit', text: 'note', n: 'note', u: 'user', color: 'type', c: 'type', warning: 'type',
        url: 'link', l: 'link', 'refresh-cache': 'refresh', a: 'all'
      }
    };
    let args = parseArgs(preparsedArgs, parseSettings);
    let command = args._.length ? args._[0].toLowerCase() : 'show';
    args.subreddit = args.link || args.subreddit ? args.subreddit : (moduleConfig && moduleConfig.defaultSubreddit ? moduleConfig.defaultSubreddit : undefined);
    if (command === 'help' || args.help) {
      return usageForRegularPeople;
    }
    if (command === 'show') {
      if (!args.user) {
        throw {error_message: 'Error: No user provided. For help, try `.tag help`.'};
      }
      return usernoteHelper.getNotes(args.subreddit, channel, {refresh: args.refresh}).then(function (parsed) {
        let notes = _.find(parsed.notes, function (obj, name) {
          if (name.toLowerCase() === args.user.toLowerCase()) {
            args.user = name;
            return true;
          }
        });
        if (notes) {
          return Promise.map(
            args.all ? notes.ns : notes.ns.slice(0,5),
            note => formatNote(note, args.subreddit, channel)
          )
            .map((note, index) => `(${index}) ${note}`)
            .then(formattedNotes =>
                formattedNotes.length < notes.ns.length
                  ? formattedNotes.concat(`...and ${notes.ns.length - formattedNotes.length} more (use --all to display).`)
                  : formattedNotes
            )
            .then(formattedNotes => [`Notes on /u/${args.user} on /r/${args.subreddit}:`].concat(formattedNotes));
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
      return getMissingInfo(args).then(props => usernoteHelper.addNote({
          mod: author_match[0],
          user: props.user,
          subreddit: props.subreddit,
          note: args.note,
          warning,
          link: props.link,
          index: command === 'append' ? undefined : 0,
          fromChannel: channel
        }).then(result => formatNote(result, props.subreddit, channel))
          .then(formattedNote => [`Successfully added note on /u/${props.user}:`, `${formattedNote}`])
      ).catch(handleErrors);
    } else if (['delete', 'rm', 'remove'].indexOf(command) !== -1) {
      if (!args.user) {
        throw {error_message: 'Error: No user provided'};
      }
      if (!args.subreddit) {
        if (moduleConfig && moduleConfig.defaultSubreddit) {
           args.subreddit = moduleConfig.defaultSubreddit;
        } else {
          throw {error_message: 'No subreddit specified. You must specify a subreddit to remove the usernote from.'};
        }
      }
      if (!_.isNumber(args._[1])) {
        throw {error_message: 'No index number provided. You must provide the index number of the note to remove.'};
      }
      return usernoteHelper.removeNote({user: args.user, subreddit: args.subreddit, index: args._[1], requester: author_match[1], fromChannel: channel}).then(note => {
        pushToCache(channel, note);
        return Promise.all(['Successfully deleted the following note. To undo this action, use ".tag undo-delete".', formatNote(note, args.subreddit, channel)]);
      }).catch(handleErrors);
    } else if (command === 'undo-delete') {
      const newNote = popFromCache(channel);
      return usernoteHelper.addNote(newNote).then(result => Promise.all(
        [`Successfully recreated note on /u/${newNote.user} on /r/${newNote.subreddit}:`, formatNote(result, newNote.subreddit, channel)]
      )).catch(err => {
        pushToCache(channel, newNote);
        handleErrors(err);
      });
    } else if (command === 'options') {
      return usageForNerds;
    } else {
      throw {error_message: `Error: Unrecognized command "${command}". For help, use ".tag help".`};
    }
  }
};

function parseUrl (url) {
  const urlParser = /^(?:(?:http(?:s?):\/\/)?(?:\w*\.)?reddit.com)?\/(?:r\/(\w{1,21})\/comments\/(\w*)(?:\/[^\/]*\/(\w*))?)|(?:message\/messages\/(\w*))/;
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

function formatNote (note, subreddit, channel) {
  return usernoteHelper.getNotes(subreddit, channel).then(parsedNotes => {
    const color = warningsToWords[parsedNotes.constants.warnings[note.w] || 'none'][0];
    const author = parsedNotes.constants.users[note.m];
    const timestamp = moment.unix(note.t).fromNow();
    let link;
    if (note.l) {
      if (note.l.charAt(0) === 'm') {
        link = `reddit.com/message/messages/${note.l.slice(2)}`;
      } else if (note.l.slice(2).includes(',')) {
        link = `reddit.com/r/${subreddit}/comments/${note.l.slice(2).replace(/,/, '/-/')}`;
      } else {
        link = `reddit.com/${note.l.slice(2)}`;
      }
    }
    const content = note.n;
    return `"${content}" (${timestamp}, by ${author}${link ? `, on link ${link} ` : ''}, ${color === 'none' ? 'no color' : 'colored '+color})`;
  });
}
function pushToCache (channel, note) {
  if (channel in removedNoteCache) {
    if (removedNoteCache[channel].length >= channelCacheMaxLength) {
      removedNoteCache[channel].shift();
    }
    removedNoteCache[channel].push(note);
  } else {
    removedNoteCache[channel] = [note];
  }
}
function popFromCache (channel) {
  if (channel in removedNoteCache && removedNoteCache[channel].length > 0) {
    return removedNoteCache[channel].pop();
  } else {
    throw {error_message: 'Error: There are no more notes in the bot\'s records.'};
  }
}
function handleErrors (err) {
  throw _.assign(err, {
    error_message: err.error_message || (err.statusCode ? `Error: Reddit sent status code ${err.statusCode}.` : 'An unknown error occured.')
  });
}
