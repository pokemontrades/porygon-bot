## Adding Tasks

Tasks are actions that the bot performs at regular intervals.

To make a new task, create a new file in this folder named `(something).js`. Alternatively, if you would like the file to be ignored by git, you can name it `(something).secret.js`.

Give the file the exports listed below. For an example, see `example.js`.

---

`period` - `Number`

A number determining how often this task should occur, in seconds.

---

`onStart` - `boolean` (default `false`)

Determines whether this task should be run on startup. For example, if `period` is 1 and `onStart` is `true`, then the task will run immediately on startup, then again 1 second later, then again 1 second later, etc. On the other hand, if `onStart` is false, then the task will not run immediately; it will run for the first time 1 second after startup, then again 1 second later, etc.

---

`concurrent` - `boolean` (default `false`)

Determines whether this task should run concurrently on multiple channels.

If set to `true`, then the task will be executed once per timestep for each channel that it is assigned to. If set to `false`, the task will only be executed once per timestep in total, and the returned value will be applied to all assigned channels.

---


`task` - `function({bot, channel})`

This function that gets called when the task executes. It should return either a single string (for a one-line response) or an array of strings (for a multi-line response). It can also return a falsey value if the bot does not need to say anything.

If `response()` throws an error, it will be handled and printed to the console. If the error has an `error_message` property, this property will be sent to the IRC in lieu of a message. This could be useful to let the members of the channel know that an error occurred. For example, `throw {error_message: 'Something bad happened'};` will send 'Something bad happened' as a response.

Note: `channel` will only be defined if `concurrent` is set to `false`.
