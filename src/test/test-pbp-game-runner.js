const warriorsLakersJson = require("./resources/warriors-lakers.json");
const _ = require("lodash");
const Bluebird = require("bluebird")

const RedisQueue = require("../lib/redis-queue")

async function run() {
    const orderedWarriorsLakersJson = _.orderBy(warriorsLakersJson, ['quarter', 'clock'], ['asc', 'desc']);
    const filteredEvents = filterImportantEvents(orderedWarriorsLakersJson);

    const redisQueue = new RedisQueue("127.0.0.1", 6379);

    const queueName = "myqueue";
    // await redisQueue.createQueue(queueName);

    await Bluebird.each(filteredEvents, async (play) => {
        await redisQueue.sendRedisQueueMsg(queueName, play);
    })

}

run().then(() => {
        process.exit(0)
    })
    .catch((err) => {
        console.error(err);
        process.exit(1)
    });

function filterImportantEvents(allPlays) {
    const filteredPlays = []

    _.forEach(allPlays, (play) => {

        if (play.event_msg_type === 13) {
            filteredPlays.push(play);
        }

    })
    return filteredPlays;
}