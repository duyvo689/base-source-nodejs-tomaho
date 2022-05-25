module.exports = {
    fileServer: "127.0.0.1",
    server: { 
        host: "127.0.0.1", 
        port: "7099" 
    },
    database: {
        host: "ec2-13-212-81-205.ap-southeast-1.compute.amazonaws.com",
        port: "27017",
        urlReplica: "",
        dbReplica: "rs01",
        replica: false,
        user: "devtraining",
        password: "d3vT@in1ng20@2",
        dbName: "devtraining",
        dbAuthMechanism: "SCRAM-SHA-1",
        poolSize: 10,
        readPreference: "slave",
    },
    logger: {},
    payloadAESPass: "Password_Dung_De_Encrypt_Decrypt_Payload",
}