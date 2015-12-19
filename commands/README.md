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
`response` - `function(message_match, author_match, isPM)`

The function that gets called when your regexes match. `message_match` and `author_match` are arrays; they are the result of `message_regex.exec(message)` and `author_regex.exec(author)`, respectively. This means that you can use matching groups in `message_regex` and `author_regex` in order to parse messages more easily. `isPM` is a boolean indicating whether the function was called in response to a private message.

`response()` should return either a single string (for a one-line response) or an array of strings (for a multi-line response). It can also return a falsey value if the bot should not respond to the command.

If `response()` throws an error, it will be handled and printed to the console. If the error has an `error_message` property, this property will be sent to the IRC in lieu of a response. This could be useful to let the sender know that an error occured. For example, `throw {error_message: 'You forgot a parameter'};` will send 'You forgot a parameter' as a response.
