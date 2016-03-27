exports.missingPeriodWarning = taskName => `Warning: The '${taskName}' task was disabled because no period was specified.
Be sure to export a 'period' parameter.`;

exports.smallPeriodWarning = (taskName, period) => `Warning: The '${taskName}' task was disabled because its period was too
small. Be sure to specify the period in milliseconds. If this task is really supposed to have a period of ${period}
milliseconds, add an 'allowFastPeriod' parameter and set it to 'true'.`;
