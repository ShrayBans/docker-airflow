import * as Bluebird from "bluebird";
import * as _ from "lodash";
import * as moment from "moment-timezone";
import { NbaBoxScore, NbaGame, NbaTeam } from "sixthman-objection-models";

import { instantiateKnex } from "../lib/knex.js";
import { createRedisClient, hmgetRedisClient, hmsetRedisClient } from "../lib/redisClient";
import { runScript, loopingPromise } from "../lib/runUtils";

runScript(runLoadRollingStats);

/**
 * calculate top 5 for each category for a team per day over last 5 days
 * store in redis key `teamId:{WARRIORS_ID}:day:20181010:top5`: { 3 Pointers: [{ name: “Stephen Curry”, avg: 6.3, id: 912843 }] }
 */

// Go through all of the teams and store in an array of teamIds [123, 124, ...]
// Iterate through each team and pull last 7 games of that team
// From last 7 games, pull all box scores scraped
// Calculate averages per player

async function runLoadRollingStats() {
    const timeInterval = 5000;
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);
    const redisClient = createRedisClient(process.env.REDIS_HOST, process.env.REDIS_PORT);
    let pstDate = moment(new Date())
        .add(1, "day")
        .toDate();

    const teamIds = await getDistinctTeams();

    const fields = [
        "fgm",
        "fga",
        "fg3m",
        "fg3a",
        "ftm",
        "fta",
        "oreb",
        "dreb",
        "reb",
        "ast",
        "tov",
        "stl",
        "blk",
        "pf",
        "pts",
        "plusMinus",
        "nbaFantasyPts",
    ];

    const exitCallback = async () => {
        const pstDateCheck = moment
            .tz(
                moment(pstDate)
                    .subtract(1, "day")
                    .toDate(),
                "America/Los_Angeles"
            )
            .format("YYYYMMDD");
        console.log(`Checking if redis stats have been found for date of: ${pstDateCheck}`);

        // Check if data has been loaded
        const homeTeamPlayers = await hmgetRedisClient(redisClient, `teamId:1610612748:day:${pstDateCheck}:top10`, [
            "reb",
        ]);
        if (_.size(homeTeamPlayers) > 0) {
            console.log(`Redis stats have been found for: ${pstDateCheck}... exiting`);
            return true;
        }
    };

    const mainCallback = async () => {
        pstDate = moment
            .tz(
                moment(pstDate)
                    .subtract(1, "day")
                    .toDate(),
                "America/Los_Angeles"
            )
            .format("YYYYMMDD");

        console.log(`Redis stats have not been found for: ${pstDate}. LOADING!`);

        const allTeamPlayerMap = {};
        const allTeamTop10Players = {};
        await Bluebird.map(teamIds, async teamId => {
            const gameIds = await getLast7Games(teamId, pstDate);
            const boxScoresPerPlayer = await getBoxScoresPerGames(teamId, gameIds);

            const playerMap = {};
            const playerTop10Map = {};

            // Calculate Sums
            _.forEach(boxScoresPerPlayer, boxScoreObject => {
                const playerId = _.get(boxScoreObject, "playerId");

                _.forEach(boxScoreObject, (value, key) => {
                    if (_.includes(fields, key) || key === "gamesPlayed") {
                        _.set(playerMap, [playerId, key], _.get(playerMap, [playerId, key], 0) + Number(value));
                    }
                });
            });

            // Calculate Averages and Percentages
            // i.e. playerStatObj {"playerId":9770268,"fgm":45,"fga":110,"fg3m":11,"fg3a":38,"oreb":2,"dreb":10,"reb":12,"ast":17,"tov":14,"stl":8,"blk":5,"pf":16,"pts":123,"plusMinus":-8,"nbaFantasyPts":187.89999999999998,"gamesPlayed":6    }
            _.forEach(playerMap, (playerStatObj, playerId) => {
                // Averages
                _.forEach(playerStatObj, (value, key) => {
                    if (_.includes(fields, String(key))) {
                        _.set(
                            playerMap,
                            [playerId, key],
                            _.get(playerMap, [playerId, key], 0) / _.get(playerMap, [playerId, "gamesPlayed"], 0)
                        );
                    }
                });

                // Percentages
                _.set(
                    playerMap,
                    [playerId, "fgPct"],
                    _.get(playerMap, [playerId, "fgm"], 0) / _.get(playerMap, [playerId, "fga"], 1)
                );
                if (_.get(playerMap, [playerId, "ftm"])) {
                    _.set(
                        playerMap,
                        [playerId, "ftPct"],
                        _.get(playerMap, [playerId, "ftm"], 0) / _.get(playerMap, [playerId, "fta"], 1)
                    );
                }
                _.set(
                    playerMap,
                    [playerId, "fg3Pct"],
                    _.get(playerMap, [playerId, "fg3m"], 0) / _.get(playerMap, [playerId, "fg3a"], 1)
                );
            });

            // Calculate top 10 of each category
            _.forEach(playerMap, (playerStatObj, playerId) => {
                _.forEach(playerStatObj, (value, key) => {
                    if (!_.get(playerTop10Map, key)) {
                        _.set(playerTop10Map, key, [
                            {
                                id: Number(playerId),
                                avg: value || 0,
                            },
                        ]);
                    } else {
                        playerTop10Map[key].push({
                            id: Number(playerId),
                            avg: value || 0,
                        });
                    }
                });
            });

            _.forEach(playerTop10Map, (playerArr, key) => {
                const sortedPlayerArr = _.orderBy(playerArr, ["avg"], ["desc"]);
                _.set(playerTop10Map, key, sortedPlayerArr);
            });

            _.set(allTeamPlayerMap, teamId, playerMap);
            _.set(allTeamTop10Players, teamId, playerTop10Map);

            await hmsetRedisClient(redisClient, `teamId:${teamId}:day:${pstDate}:top10`, playerTop10Map);
            await hmsetRedisClient(redisClient, `teamId:${teamId}:day:${pstDate}:playerstats`, playerMap);
        });
    };

    return await loopingPromise(exitCallback, mainCallback, timeInterval);
}

async function getDistinctTeams() {
    const nbaTeams = await NbaTeam.query().distinct("id");
    return _.map(nbaTeams, "id");
}
async function getLast7Games(teamId, pstDate) {
    const nbaGames = await NbaGame.query()
        .where("status", "=", "completed")
        .where(builder => {
            builder.where("home_team_id", "=", teamId).orWhere("away_team_id", "=", teamId);
        })
        .where("game_datetime", "<", Number(pstDate))
        .orderBy("game_datetime", "desc")
        .select("id")
        .limit(10);
    return _.map(nbaGames, "id");
}
async function getBoxScoresPerGames(teamId, gameIds) {
    const nbaBoxScores = await NbaBoxScore.query()
        .where({
            team_id: teamId,
        })
        .whereIn("game_id", gameIds);
    return _.map(nbaBoxScores, boxScore => ({
        ...boxScore,
        gamesPlayed: 1,
    }));
}
