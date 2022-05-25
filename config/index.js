var _ = require('lodash');
var defaults = require('./default');
var config;
if (process.env.NODE_ENV && process.env.NODE_ENV.includes('production')) {
    config = require('./production')
} else {
    config = require('./development')
}
module.exports = _.merge({}, defaults, config);