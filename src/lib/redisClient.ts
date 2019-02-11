import * as _ from "lodash";
import * as redis from "redis";

export function createRedisClient(host, port) {
    const client = redis.createClient({
        host: host,
        port: Number(port) || 6379,
    });
    return client;
}

/**
 * This function will format and transform given inputs into:
 * ["foobar", "foo", "bar", "x", "y"]
 * @param redisClient
 * @param key foobar
 * @param object { foo: bar, x: y }
 */
export async function hmsetRedisClient(redisClient, key, object) {
    const flattenedObject = _.flatMap(object, (value, key) => {
        return [key, JSON.stringify(value)];
    });
    const hmsetArray = [key].concat(flattenedObject);

    return new Promise((resolve, reject) => {
        //@ts-ignore
        redisClient.hmset(hmsetArray, (err, data) => {
            if (err) {
                console.error("err", err);
                reject(err);
            }

            return resolve(data);
        });
    });
}

/**
 * This function will format and transform given inputs into: ["foobar", "foo", "bar", "x", "y"] for redis
 * Redis turns ["bar", "y"]
 * Functions zips hashKeyArray with redis Result to get { foo: "bar", x: "y"}
 * @param redisClient
 * @param key foobar
 * @param hashKeyArray ["foo", "x"]
 */
export async function hmgetRedisClient(redisClient, key, hashKeyArray) {
    const hmsetArray = [key].concat(hashKeyArray);

    return new Promise((resolve, reject) => {
        redisClient.hmget(hmsetArray, (err, data) => {
            if (err) {
                console.error("err", err);
                reject(err);
            }
            if (_.head(data) === null) {
                return resolve(undefined);
            } else {
                try {
                    const parsedData = _.map(data, datum => {
                        return JSON.parse(datum);
                    });
                    const zippedObject = _.zipObject(hashKeyArray, parsedData);
                    return resolve(zippedObject);
                } catch (err) {
                    reject(err);
                }
            }
        });
    });
}
