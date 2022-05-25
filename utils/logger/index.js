const fs = require('fs');
const { Console } = require('console');
const { utcToZonedTime, format } = require('date-fns-tz');
const config = require('../../config').logger;
const pattern = "yyyy-MM-dd HH:mm:ss.SSS (z)";

const output = fs.createWriteStream(config.logPath, { flags: 'a' });
const errorOutput = fs.createWriteStream(config.errorPath, { flags: 'a' });
var logger = new Console({ stdout: output, stderr: errorOutput });
var log = logger.log;
logger.log = function (obj, ...args) {
    if (typeof obj === 'string') {
        args.unshift(format(utcToZonedTime(new Date(), 'Asia/Ho_Chi_Minh'), pattern) + " " + obj);
    } else {
        args.unshift(obj);
        args.unshift(format(utcToZonedTime(new Date(), 'Asia/Ho_Chi_Minh'), pattern))
    }
    return log.apply(logger, args);
}
var error = logger.error;
logger.error = function (obj, ...args) {
    if (typeof obj === 'string') {
        args.unshift(format(utcToZonedTime(new Date(), 'Asia/Ho_Chi_Minh'), pattern) + " " + obj);
    } else {
        args.unshift(obj);
        args.unshift(format(utcToZonedTime(new Date(), 'Asia/Ho_Chi_Minh'), pattern))
    }
    return error.apply(logger, args);
}
module.exports = logger;

