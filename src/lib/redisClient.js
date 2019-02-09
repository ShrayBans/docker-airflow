const redis = require("redis");
const {
    Base
} = require("sixthman-objection-models")
const _ = require("lodash")

function createRedisClient(host, port) {
    const client = redis.createClient({
        host: host,
        port: Number(port) || 6379,
    });
    return client;
}

async function hmsetRedisClient(redisClient, key, object) {
    const flattenedObject = _.flatMap(object, (value, key) => {
        return [key, JSON.stringify(value)];
    });
    const hmsetObject = [key].concat(flattenedObject);

    return new Promise((resolve, reject) => {
        //@ts-ignore
        redisClient.hmset(hmsetObject, (err, data) => {
            if (err) {
                console.error('err', err);
                reject(err);
            }

            return resolve(data);
        });
    });
}

async function hmgetRedisClient(redisClient, key, hashKey) {
    return new Promise((resolve, reject) => {
        //@ts-ignore
        redisClient.hmget([key, hashKey], (err, data) => {
            if (err) {
                console.error("err", err);
                reject(err);
            }
            let parsedData;
            if (_.head(data) === null) {
                return resolve(undefined);
            } else {
                try {
                    parsedData = JSON.parse(data);
                } catch (err) {
                    reject(err);
                }

                return resolve(parsedData);
            }
        });
    });
}


module.exports = {
    createRedisClient: createRedisClient,
    hmsetRedisClient: hmsetRedisClient,
    hmgetRedisClient: hmgetRedisClient,
}