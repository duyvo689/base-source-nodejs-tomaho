"use strict";
const path = require('path');

process.send = process.send || function () { };

require('ignore-styles');

require('@babel/register')({
    configFile: path.resolve(__dirname, './babel.config.js'),
});
const Server = require('./utils').Server;
const tomaho = new Server();

tomaho.start();