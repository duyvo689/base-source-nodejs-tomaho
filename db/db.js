
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const { database } = require('../config');
const dbUser = encodeURIComponent(database.user);
const dbPassword = encodeURIComponent(database.password);
const dbHost = database.host;
const dbPort = database.port;
const authMechanism = database.dbAuthMechanism;
const runReplica = database.replica;
const dbReplica = database.dbReplica;
const urlReplica = database.urlReplica;
const dbName = database.dbName;
const poolSize = process.env.dbPoolSize || database.poolSize;
const readPrefer = database.readPreference;

let connection_url;
let connection_opts;
if (!runReplica) {
    connection_url = `mongodb://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/?authMechanism=${authMechanism}`;
    connection_opts = { poolSize: poolSize, useUnifiedTopology: true, authSource: dbName }
} else {
    connection_url = `mongodb://${dbUser}:${dbPassword}@${urlReplica}/?authMechanism=${authMechanism}`;
    connection_opts = {
        poolSize: poolSize, useUnifiedTopology: true,
        replicaSet: dbReplica, authSource: dbName, readPreference: readPrefer
    }
}
let dbConnection = null;
let dbSession = null;
function createConnectionPool() {
    return new Promise((resolve, reject) => {
        MongoClient.connect(connection_url, connection_opts, (err, connection) => {
            assert.equal(null, err);
            if (err) {
                reject(err);
            } else {
                console.log('Create connection to database server');
                connection.on('close', (err, res) => {
                    console.log('Close connection');
                    dbConnection = null;
                    dbSession = null;
                    process.exit(err ? 1 : 0);
                });
                dbConnection = connection;
                dbSession = connection.db(`${dbName}`);
                resolve(connection);
            }
        })
    });
}
function getConnection() {
    return dbConnection;
}
function getDBSession() {
    return dbSession;
}
module.exports = { createConnectionPool, getConnection, getDBSession };