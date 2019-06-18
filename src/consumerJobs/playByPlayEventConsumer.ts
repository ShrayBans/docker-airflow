import { instantiateKnex } from "../lib/knex.js";
import { createRedisClient } from "../lib/redisClient";
import { RedisQueue } from "../lib/RedisQueue";
import { runScript, singlePromise } from "../lib/runUtils";
import { evaluateNbaEventMessage } from "../services/evaluateNbaEventMessage";

runScript(runPlayByPlayEventConsumer);

/**
 * This job should runPlayByPlayEventConsumer whenever games are being run.
 */
async function runPlayByPlayEventConsumer() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);
    const redisQueue = new RedisQueue(process.env.REDIS_HOST, process.env.REDIS_PORT);
    const redisClient = createRedisClient(process.env.REDIS_HOST, process.env.PORT);
    const queueName = process.env.PLAY_BY_PLAY_QUEUE || "myqueue";
    const callback = async () => {
        await redisQueue.createQueue(queueName);
        await redisQueue.runRSMQConsumer(queueName, evaluateNbaEventMessage(redisClient));
    };
    await singlePromise(callback);
}
