##Adding Commands

To make a new command, create a new file in this folder named `(something).js`. Alternatively, if you would like the file to be ignored by git, you can name it `(something).secret.js`.

Give the file the imports listed below. For an example, see `example.js`.

___
`message_regex` - `RegExp`

A regular expression that determines whether the bot should respond to any given message. The `response()` function will get called only if `message_regex` and `author_regex` both match the message and the author, respectively. If `message_regex` is not provided, the function will never get called.

___
`author_regex` - `RegExp`

See `message_regex`. Note that unlike `message_regex`, `author_regex` is not required and defaults to `/.*/` (i.e. all authors). However, the bot will never reply to itself.

___
`allow` - `function (isPM, isMod, isAuthenticated)`

This function allows the message to be filtered before it the `response()` function gets called. If it returns a falsy value, `response` will not get called. If the function is not provided, it defaults to:

```javascript
function defaultAllow(isPM, isMod, isAuthenticated) {
  return !isPM || isMod && isAuthenticated; // Allow all non-PMs, but only allow PMs if the sender is an authenticated mod.
}
```

* `isPM` - a `boolean` indicating whether the message was sent by PM
* `isMod - a `boolean` indicating whether the sender of the message is in the mod database. Warning: If `config.disable_db` is true, `isMod` will always be `true`.
* `isAuthenticated` - a `boolean` indicating whether the sender of the message is authenticated with NickServ.

___
`response` - `function(message_match, author_match, isPM, isMod, isAuthenticated)`

This function that gets called when your regexes match. It should return either a single string (for a one-line response) or an array of strings (for a multi-line response). It can also return a falsey value if the bot should not respond to the command.

If `response()` throws an error, it will be handled and printed to the console. If the error has an `error_message` property, this property will be sent to the IRC in lieu of a response. This could be useful to let the sender know that an error occured. For example, `throw {error_message: 'You forgot a parameter'};` will send 'You forgot a parameter' as a response.

`message_match` - `Array` - the result of `message_regex.exec(message)`
`author_match` - `Array` - the result of `author_regex.exec(author)`
`isPM` - see `allow()` above
`isMod` - see `allow()` above
`isAuthenticated` - see `allow()` above
