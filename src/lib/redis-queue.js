const RedisSMQ = require("rsmq");
const _ = require("lodash");
const Bluebird = require("bluebird")

process.env.DEBUG = false;

class RedisQueue {
    constructor(host, port) {
        this.rsmq = new RedisSMQ({
            host: host || "127.0.0.1",
            port: Number(port) || 6379,
            ns: "rsmq"
        });
        this.host = host;
        this.port = port;
    }

    async createQueue(queueName) {
        try {
            const queue = await this.rsmq.createQueueAsync({
                qname: queueName
            })
            if (queue === 1) {
                console.log(`queue created: ${queueName}`)
            }
        } catch (err) {
            if (process.env.DEBUG == "true") {
                console.log(`${err.name}: ${queueName}`);
            }
        }
    }

    async sendRedisQueueMsg(queueName, msg) {
        try {
            const message = await this.rsmq.sendMessageAsync({
                qname: queueName,
                message: JSON.stringify(msg)
            });
            if (message) {
                if (process.env.DEBUG == "true") {
                    console.log("Message sent. ID:", message);
                }
            }
            return message;
        } catch (err) {
            console.error('err', err);
        }
    }

    async runRSMQConsumer(queueName, callback) {
        return new Promise((resolve, reject) => {
            try {
                setInterval(async () => {
                    // const receivedMessages = [];
                    const receivedMessage = await this.receiveRedisQueueMsg(queueName);

                    if (_.get(receivedMessage, "messageId")) {
                        await callback(receivedMessage)
                        await this.deleteRedisQueueMsg(queueName, _.get(receivedMessage, "messageId"));
                    }


                    return receivedMessage;
                }, 5);

                if (process.env.DEBUG == "true") {
                    console.log('DONE');
                }
            } catch (err) {
                reject(err)
            }
        })
    }

    async runSpecRSMQConsumer(queueName, callback, count = 100) {
        return new Promise(async (resolve, reject) => {
            try {
                await Bluebird.each(_.times(count), async () => {
                    // const receivedMessages = [];
                    const receivedMessage = await this.receiveRedisQueueMsg(queueName);

                    if (_.get(receivedMessage, "messageId")) {
                        await callback(receivedMessage)
                        await this.deleteRedisQueueMsg(queueName, _.get(receivedMessage, "messageId"));
                    }


                    return receivedMessage;
                })

                resolve("Done with Spec Consumer")
            } catch (err) {
                reject(err)
            }
        })
    }

    async receiveRedisQueueMsg(queueName) {
        try {
            const received = await this.rsmq.receiveMessageAsync({
                qname: queueName,
            })
            if (_.isEmpty(received)) return false;

            const parsedMessage = JSON.parse(_.get(received, "message"));
            if (parsedMessage.id) {
                if (process.env.DEBUG == "true") {
                    console.log("Message received.", parsedMessage)
                }
            }

            return {
                messageId: received.id,
                message: parsedMessage
            };
        } catch (err) {
            console.error('err', err);
        }
    }

    async deleteRedisQueueMsg(queueName, messageId) {
        try {
            const resolvedPromise = await new Promise((resolve, reject) => {
                this.rsmq.deleteMessage({
                    qname: queueName,
                    id: messageId
                }, function(err, resp) {
                    if (resp === 1) {
                        if (process.env.DEBUG == "true") {
                            console.log(`Message ${messageId} deleted.`)
                        }
                        return resolve(true)
                    } else {
                        if (process.env.DEBUG == "true") {
                            console.log(`Message ${messageId} not found.`)
                        }
                        return reject(err)
                    }
                });
            });


            return resolvedPromise;
        } catch (err) {
            console.error('err', err);
        }
    }
}

module.exports = RedisQueue;