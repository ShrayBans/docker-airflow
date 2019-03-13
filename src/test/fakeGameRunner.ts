import * as Bluebird from "bluebird";
import * as _ from "lodash";
import { NbaPlayByPlay } from "sixthman-objection-models";

import { RedisQueue } from "../lib/RedisQueue";

export async function fakeGameRunner(queueName = "myqueue", pathToGameJson, skipPostgres?: boolean) {
    const warriorsLakersJson = require(pathToGameJson);

    const orderedWarriorsLakersJson = _.orderBy(warriorsLakersJson, ["quarter", "clock"], ["asc", "desc"]);
    const filteredEvents = filterImportantFakeNbaEvents(orderedWarriorsLakersJson);

    if (!skipPostgres) {
        // Insert into PG
        console.log("Inserting Game PlayByPlay Info into PG");
        await Bluebird.each(orderedWarriorsLakersJson, async playByPlayInfo => {
            let nbaPlayByPlay = await NbaPlayByPlay.query().findOne({
                game_id: _.get(playByPlayInfo, "gameId"),
                quarter: _.get(playByPlayInfo, "quarter"),
                clock: _.get(playByPlayInfo, "clock"),
                event_msg_type: _.get(playByPlayInfo, "eventMsgType"),
                description: _.get(playByPlayInfo, "description"),
            });
            if (!nbaPlayByPlay) {
                nbaPlayByPlay = await NbaPlayByPlay.query().insertAndFetch(playByPlayInfo);
            }

            return nbaPlayByPlay;
        });
    }

    const redisQueue = new RedisQueue(process.env.REDIS_HOST || "127.0.0.1", process.env.REDIS_PORT || 6379);

    await redisQueue.createQueue(queueName);

    await Bluebird.each(filteredEvents, async play => {
        await redisQueue.sendRedisQueueMsg(queueName, play);
    });
}

export function filterImportantFakeNbaEvents(allPlays) {
    const filteredPlays = [];

    _.forEach(allPlays, play => {
        if (play.eventMsgType === 13 || play.eventMsgType === 12) {
            filteredPlays.push(play);
        }
    });
    return filteredPlays;
}
