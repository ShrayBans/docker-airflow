const redis = require("redis");
const {
    Base
} = require("sixthman-objection-models")

function createRedisClient(host, port) {
    const client = redis.createClient({
        host: host,
        port: Number(port) || 6379,
    });
    return client;
}

module.exports = {
    createRedisClient: createRedisClient
}