import * as Bluebird from "bluebird";
import * as _ from "lodash";
import { NbaPlayByPlay } from "sixthman-objection-models";

import { RedisQueue } from "../lib/RedisQueue";

export async function fakeGameRunner(queueName = "myqueue", pathToGameJson) {
    const warriorsLakersJson = require(pathToGameJson);

    const orderedWarriorsLakersJson = _.orderBy(warriorsLakersJson, ["quarter", "clock"], ["asc", "desc"]);
    const filteredEvents = filterImportantEvents(orderedWarriorsLakersJson);

    // Insert into PG
    console.log("Inserting Game PlayByPlay Info into PG");
    await Bluebird.each(orderedWarriorsLakersJson, async playByPlayInfo => {
        let nbaPlayByPlay = await NbaPlayByPlay.query().findOne({
            game_id: _.get(playByPlayInfo, "game_id"),
            quarter: _.get(playByPlayInfo, "quarter"),
            clock: _.get(playByPlayInfo, "clock"),
            event_msg_type: _.get(playByPlayInfo, "event_msg_type"),
            description: _.get(playByPlayInfo, "description"),
        });
        if (!nbaPlayByPlay) {
            nbaPlayByPlay = await NbaPlayByPlay.query().insertAndFetch(playByPlayInfo);
        }

        return nbaPlayByPlay;
    });

    const redisQueue = new RedisQueue("127.0.0.1", 6379);

    await redisQueue.createQueue(queueName);

    await Bluebird.each(filteredEvents, async play => {
        await redisQueue.sendRedisQueueMsg(queueName, play);
    });
}

function filterImportantEvents(allPlays) {
    const filteredPlays = [];

    _.forEach(allPlays, play => {
        if (play.event_msg_type === 13) {
            filteredPlays.push(play);
        }
    });
    return filteredPlays;
}
