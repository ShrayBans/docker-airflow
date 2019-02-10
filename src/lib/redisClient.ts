import _ from "lodash";
import * as redis from "redis";

export function createRedisClient(host, port) {
    const client = redis.createClient({
        host: host,
        port: Number(port) || 6379,
    });
    return client;
}

export async function hmsetRedisClient(redisClient, key, object) {
    const flattenedObject = _.flatMap(object, (value, key) => {
        return [key, JSON.stringify(value)];
    });
    const hmsetObject = [key].concat(flattenedObject);

    return new Promise((resolve, reject) => {
        //@ts-ignore
        redisClient.hmset(hmsetObject, (err, data) => {
            if (err) {
                console.error("err", err);
                reject(err);
            }

            return resolve(data);
        });
    });
}

export async function hmgetRedisClient(redisClient, key, hashKey) {
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
