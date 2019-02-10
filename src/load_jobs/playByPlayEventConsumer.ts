import * as _ from "lodash";

import { instantiateKnex } from "../lib/knex.js";
import { RedisQueue } from "../lib/RedisQueue";
import { answerAutomatedQuestion } from "../services/answerAutomatedQuestion";
import { singlePromise, runScript } from "../lib/runUtils";

runScript(runPlayByPlayEventConsumer);

/**
 * This job should runPlayByPlayEventConsumer whenever games are being run.
 */
async function runPlayByPlayEventConsumer() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);
    const redisQueue = new RedisQueue(process.env.REDIS_HOST, process.env.REDIS_PORT);
    const queueName = "myqueue";
    const callback = async () => {
        await redisQueue.runRSMQConsumer(queueName, evaluateNbaEventMessage);
    };
    await singlePromise(callback);
}

export async function evaluateNbaEventMessage(receivedPlayByPlayEvent) {
    // Automated Question Answering
    await answerAutomatedQuestion(receivedPlayByPlayEvent);
}
