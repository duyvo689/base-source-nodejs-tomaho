const express = require('express');
const app = express();

const { server } = require('../../config');
const { createConnectionPool } = require('../../db');
const logger = require('../logger');


class Server {
    constructor() {
        this.port = process.env.PORT || server.port;
        this.host = server.host;
    }

    start() {
        const self = this;
        createConnectionPool().then(connection => {
            app.use('/api', express.json())
            app.use('/api', express.urlencoded({ extended: true }))

            app.use('/', require('../../addons/base').routes)
            app.use('/', require('../../addons/training').routes)
            require('../../addons/tomaho')

            // Server start listen
            app.listen(self.port, () => {
                console.log(`Tomaho Backend listening at http://${self.host}:${self.port}`)
            })

			process.on('SIGINT', () => { connection.close() })
            process.on('message', (msg) => {
                if (msg === 'shutdown') {
                    connection.close()
                    setTimeout(() => { process.exit(0); }, 1500)
                }
            })
        }).catch((err) => {
            console.log("Tomaho Server Auth Start Error: ", JSON.stringify(err))
        })
    }
}

module.exports = Server;