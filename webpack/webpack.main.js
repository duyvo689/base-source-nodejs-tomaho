const client = require('./webpack.client.config');
const server = require('./webpack.server.config');

module.exports = (env, argv) => {
    return [client(env, argv), server(env, argv)];
}