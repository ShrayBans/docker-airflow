const _ = require("lodash");
const Bluebird = require("bluebird")

const RedisQueue = require("../lib/redis-queue")

const {
    NbaTeam,
    NbaGame,
    NbaPlayByPlay
} = require("sixthman-objection-models")

async function fakeGameRunner(queueName = "myqueue", pathToGameJson) {
    const warriorsLakersJson = require(pathToGameJson);

    const orderedWarriorsLakersJson = _.orderBy(warriorsLakersJson, ['quarter', 'clock'], ['asc', 'desc']);
    const filteredEvents = filterImportantEvents(orderedWarriorsLakersJson);

    // Insert into PG
    console.log("Inserting Game Info into PG")
    await Bluebird.each(orderedWarriorsLakersJson, async (playByPlayInfo) => {
        let nbaPlayByPlay = await NbaPlayByPlay.query().findOne({
            game_id: _.get(playByPlayInfo, "game_id"),
            quarter: _.get(playByPlayInfo, "quarter"),
            clock: _.get(playByPlayInfo, "clock"),
            event_msg_type: _.get(playByPlayInfo, "event_msg_type")
        });
        if (!nbaPlayByPlay) {
            nbaPlayByPlay = await NbaPlayByPlay.query().insert(playByPlayInfo);
        }

        return nbaPlayByPlay;
    })

    const redisQueue = new RedisQueue("127.0.0.1", 6379);

    await redisQueue.createQueue(queueName);

    await Bluebird.each(filteredEvents, async (play) => {
        await redisQueue.sendRedisQueueMsg(queueName, play);
    })
}

// fakeGameRunner("./resources/warriors-lakers.json").then(() => {
//         process.exit(0)
//     })
//     .catch((err) => {
//         console.error(err);
//         process.exit(1)
//     });

function filterImportantEvents(allPlays) {
    const filteredPlays = []

    _.forEach(allPlays, (play) => {

        if (play.event_msg_type === 13) {
            filteredPlays.push(play);
        }

    })
    return filteredPlays;
}

module.exports = {
    fakeGameRunner
}