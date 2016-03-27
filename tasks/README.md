## Adding Tasks

Tasks are actions that the bot performs at regular intervals.

To make a new task, create a new file in this folder named `(something).js`. Alternatively, if you would like the file to be ignored by git, you can name it `(something).secret.js`.

Give the file the exports listed below. For an example, see `example.js`.

---

`period` - `Number`

A number determining how often this task should occur, in milliseconds.

Note: By default, a task with a period of less than 5 seconds will not run, and will leave a warning on the console. This is to avoid inadvertent spam if the period is accidentally specified in seconds rather than in milliseconds. If a task should really be run more than once every 5 seconds, add an `allowFastPeriod` parameter and set it to `true`.

---

`onStart` - `boolean` (default `false`)

Determines whether this task should be run on startup. For example, if `period` is 1000 and `onStart` is `true`, then the task will run immediately on startup, then again 1 second later, then again 1 second later, etc. On the other hand, if `onStart` is false, then the task will not run immediately; it will run for the first time 1 second after startup, then again 1 second later, etc.

---

`concurrent` - `boolean` (default `false`)

Determines whether this task should run concurrently on multiple channels.

If set to `true`, then the task will be executed once per timestep for each channel that it is assigned to. If set to `false`, the task will only be executed once per timestep in total, and the returned value will be applied to all assigned channels.

---


`task` - `function({bot, channel})`

This function that gets called when the task executes. It should return either a single string (for a one-line response) or an array of strings (for a multi-line response). It can also return a falsey value if the bot should not respond to the command.

If `response()` throws an error, it will be handled and printed to the console. If the error has an `error_message` property, this property will be sent to the IRC in lieu of a response. This could be useful to let the sender know that an error occured. For example, `throw {error_message: 'You forgot a parameter'};` will send 'You forgot a parameter' as a response.

Note: `channel` will only be defined if `concurrent` is set to `false`.

---

**Note**: By default, all tasks are performed on a per-channel basis. In other words, if the same task is enabled for multiple channels simultaneously, the task will be run multiple times. To
