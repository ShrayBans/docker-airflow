import * as Bluebird from "bluebird";
import * as _ from "lodash";
import { NbaGame, NbaPlayer } from "sixthman-objection-models";

const moment = require("moment-timezone");
const { instantiateKnex } = require("../lib/knex.js");
const { createRedisClient, hmgetRedisClient } = require("../lib/redisClient.js");

async function run() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);

    const redisClient = createRedisClient(process.env.REDIS_HOST);

    return new Promise(async (resolve, reject) => {
        try {
            const thirtyMinuteAfterDate = moment(new Date())
                .add(30, "minutes")
                .toDate();
            const gamesToPull = await getGamesStartingBefore(thirtyMinuteAfterDate);

            await Bluebird.each(gamesToPull, async game => {
                const topPlayers = await pullTop4Players(redisClient, game, "pts");
                console.log("topPlayers", topPlayers);
            });

            /**
                5 Pregame Questions:
                Who will score the most points for the game?
                Who will get the most rebounds?
                Who will make the first basket?
                Who will make the first 3 pointer?
                Who will win the game?

                Before 2nd Quarter:
                Who will shoot the worst in this quarter?
                Who wins this quarter?
                Who has the most 3 pointers at the half?

                Halftime/Before 3rd Quarter:
                Who will make the most free throws this quarter?
                Who wins this quarter?
                Who will have the most assists in this quarter?
                Who will make the last basket of the quarter?

                Before 4th quarter:
                Who will have the most points this quarter?
                Who will make the last basket?
                Who will have the most 3’s this quarter?
             */

            // await hmgetRedisClient(redisClient, `teamId:${teamId}:day:${pstDate}:top10`);

            //     const createAutomatedQuestionPayload = {
            //         channelId,
            //         questionGroupId,
            //         questionName: "AUTOMATED: Who will have the most points in the 3rd quarter?",
            //         pointWeight: 10,
            //         statId: await getNbaAutomatedStatId("points"),
            //         automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
            //         automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
            //         gameId: 21800500,
            //         questionType: "multi_choice",
            //         answersPayload: [
            //             {
            //                 value: "LeBron James",
            //                 playerId: 2544,
            //                 teamId: 1610612747,
            //             },
            //             {
            //                 value: "Stephen Curry",
            //                 playerId: 201939,
            //                 teamId: 1610612744,
            //             },
            //             {
            //                 value: "Kevin Durant",
            //                 playerId: 201142,
            //                 teamId: 1610612744,
            //             },
            //             {
            //                 value: "Andre Iguodala",
            //                 playerId: 2738,
            //                 teamId: 1610612744,
            //             },
            //         ],
            //     };

            //     const createdQuestion = await createAutomatedQuestion(createAutomatedQuestionPayload);
            //     console.log("createdQuestion", createdQuestion);

            resolve(1);
        } catch (err) {
            reject(err);
        }
    });
}

async function getAllPlayersByIds(playerIds) {
    return NbaPlayer.query().whereIn("id", playerIds);
}

run()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

async function pullTop4Players(redisClient, game, stat) {
    let homeTeamPlayers;
    let awayTeamPlayers;
    let allPlayerIds;
    let allPlayers;

    // const pstDate = moment.tz(_.get(game, "gameDatetime"), "America/Los_Angeles").format("YYYYMMDD");
    const pstDate = 20190113;

    const homeTeamId = _.get(game, "homeTeamId");
    const awayTeamId = _.get(game, "awayTeamId");
    homeTeamPlayers = await hmgetRedisClient(redisClient, `teamId:${homeTeamId}:day:${pstDate}:top10`, stat);
    homeTeamPlayers = _.take(homeTeamPlayers, 2);
    awayTeamPlayers = await hmgetRedisClient(redisClient, `teamId:${awayTeamId}:day:${pstDate}:top10`, stat);
    awayTeamPlayers = _.take(awayTeamPlayers, 2);
    allPlayerIds = _.map(awayTeamPlayers, "id").concat(_.map(homeTeamPlayers, "id"));
    allPlayers = await getAllPlayersByIds(allPlayerIds);

    return allPlayers;
}

async function getGamesStartingBefore(date = new Date()) {
    const UTCString = date.toUTCString();
    return NbaGame.query()
        .where("status", "!=", "completed")
        .where("game_datetime", "<", UTCString);
}
