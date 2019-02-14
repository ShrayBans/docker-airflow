import * as Bluebird from "bluebird";
import * as moment from "moment-timezone";
import { NbaGame } from "sixthman-objection-models";

import { createRedisClient } from "../lib/redisClient";
import { singlePromise, runScript } from "../lib/runUtils";
import { createScheduledQuestionsPerGame } from "../services/createScheduledQuestionsPerGame";

const { instantiateKnex } = require("../lib/knex.js");

runScript(scheduledQuestionCreatorTester);

async function scheduledQuestionCreatorTester() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);

    const quarterTrigger = "pregame";
    const redisClient = createRedisClient(process.env.REDIS_HOST, process.env.PORT);

    const mainCallback = async () => {
        const thirtyMinuteAfterDate = moment(new Date())
            .add(1, "day")
            // .add(30, "minutes")
            .toDate();
        const gamesToPull = await getGamesStartingBefore(thirtyMinuteAfterDate);

        // i.e { [gameId20004404]: { reb: [{Player1}, {Player2}, {Player3}] }}
        await Bluebird.each(gamesToPull, async game => {
            await createScheduledQuestionsPerGame(redisClient, game, quarterTrigger);
        });
    };

    await singlePromise(mainCallback);
}

async function getGamesStartingBefore(date = new Date()) {
    const UTCString = date.toUTCString();
    return NbaGame.query()
        .where("status", "!=", "completed")
        .where("game_datetime", "<", UTCString);
}
