import * as Bluebird from "bluebird";
import * as _ from "lodash";
import { NbaGame, NbaPlayer, NbaStat, QuestionGroup } from "sixthman-objection-models";
import { singlePromise, runScript } from "../lib/runUtils";

import * as moment from "moment-timezone";
const { instantiateKnex } = require("../lib/knex.js");
import { createRedisClient, hmgetRedisClient } from "../lib/redisClient";
import { getNbaAutomatedStatId, getNbaAutomatedModeId, getNbaAutomatedPeriodId } from "./fixtures/nbaDimensions";
import { createAutomatedQuestion } from "./automatedQuestionCreator";

/**
 *    5 Pregame Questions:
 *    Who will score the most points for the game?
 *    Who will get the most rebounds?
 *    Who will make the first basket?
 *    Who will make the first 3 pointer?
 *    Who will win the game?
 *
 *    Before 2nd Quarter:
 *    Who will shoot the worst in this quarter?
 *    Who wins this quarter?
 *    Who has the most 3 pointers at the half?
 *
 *    Halftime/Before 3rd Quarter:
 *    Who will make the most free throws this quarter?
 *    Who wins this quarter?
 *    Who will have the most rebounds in this quarter?
 *    Who will make the last basket of the quarter?
 *
 *    Before 4th quarter:
 *    Who will have the most points this quarter?
 *    Who will make the last basket?
 *    Who will have the most 3’s this quarter?
 */

runScript(scheduledQuestionCreator);

async function scheduledQuestionCreator() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);

    const quarterTrigger = "pregame";
    const redisClient = createRedisClient(process.env.REDIS_HOST, process.env.PORT);

    const mainCallback = async () => {
        const thirtyMinuteAfterDate = moment(new Date())
            .add(1, "day")
            // .add(30, "minutes")
            .toDate();
        const gamesToPull = await getGamesStartingBefore(thirtyMinuteAfterDate);
        const nbaStats = await NbaStat.query();
        const nbaStatAbbrevs = _.map(nbaStats, "abbrev");

        // i.e { [gameId20004404]: { reb: [{Player1}, {Player2}, {Player3}] }}
        const gameByStatByPlayerMap = {};
        await Bluebird.each(gamesToPull, async game => {
            const gameId: number = _.get(game, "id");
            const topPlayersPerStat = await pullTop4PlayersPerStat(redisClient, game, nbaStatAbbrevs);
            _.set(gameByStatByPlayerMap, gameId, topPlayersPerStat);

            await createAutomatedQuestionWrapper(gameId, topPlayersPerStat, quarterTrigger);
        });

        // console.log("gameByStatByPlayerMap", gameByStatByPlayerMap);
    };

    await singlePromise(mainCallback);
}

async function getAllPlayersByIds(playerIds) {
    return NbaPlayer.query().whereIn("id", playerIds);
}

async function getAllScheduledAutomatedQuestions(channelId, quarterTrigger) {
    // Period id dictates period as well as
    const scheduledAutomatedQuestions = [
        {
            id: 0,
            automatedPeriodId: await getNbaAutomatedStatId("points"),
            automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
            statId: await getNbaAutomatedPeriodId("full_game"),
            channelId,
            pointValue: 10,
            stat: {},
            automatedPeriod: {},
            automatedMode: {},
        },
        {
            id: 0,
            automatedPeriodId: await getNbaAutomatedStatId("points"),
            automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
            statId: await getNbaAutomatedPeriodId("first_half"),
            channelId,
            pointValue: 10,
            stat: {},
            automatedPeriod: {},
            automatedMode: {},
        },
        {
            id: 0,
            automatedPeriodId: await getNbaAutomatedStatId("rebound"),
            automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
            statId: await getNbaAutomatedPeriodId("full_game"),
            channelId,
            pointValue: 10,
            stat: {},
            automatedPeriod: {},
            automatedMode: {},
        },
        {
            id: 0,
            automatedPeriodId: await getNbaAutomatedStatId("field_goal"),
            automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
            statId: await getNbaAutomatedPeriodId("full_game"),
            channelId,
            pointValue: 10,
            stat: {},
            automatedPeriod: {},
            automatedMode: {},
        },
    ];

    // return ScheduledAutomatedQuestion.query().whereNull("channel_id").orWhere("channel_id", channelId).eager(`[stat, automatedPeriod, automatedMode]`);
    // join to automated_period and match up quarter_trigger

    return scheduledAutomatedQuestions;
}

/**
 * 1. Pulls all scheduled automated questions to be created associated with the corresponding quarterTrigger (i.e. "pregame")
 * 2. Uses the scheduled automated questions to determine what stat x mode x period to and formats a questionName based on it
 * 3. Pulls top 4 player stats based on the gameId and the stat pulled (pts, gsw vs lakers) -> KD, Steph, Lebron, Kuzma
 * 4. Defaults questionType to multiple_choice
 * 5. Creates questions based on previous fields
 */
async function createAutomatedQuestionWrapper(gameId, topStats, quarterTrigger = "pregame") {
    console.log("gameId, topStats, quarterTrigger", gameId, quarterTrigger);
    const questionName = "";

    const questionGroups = QuestionGroup.query().where("nba_game_id", gameId);
    // Creates a question per question group - TODO: Remove to make it one question group per
    await Bluebird.each(questionGroups, async questionGroup => {
        const questionGroupId = _.get(questionGroup, "id");
        const channelId = _.get(questionGroup, "channelId");

        const scheduledAutomatedQuestions = await getAllScheduledAutomatedQuestions(channelId, quarterTrigger);
        console.log("scheduledAutomatedQuestions", scheduledAutomatedQuestions);
        await Bluebird.each(scheduledAutomatedQuestions, async scheduledAutomatedQuestion => {
            const predictedPlayers = _.get(topStats, "pts");
            // Transforms id into playerId
            const transformedPredictedPlayers = _.map(predictedPlayers, predictedPlayer => {
                return {
                    playerId: _.get(predictedPlayer, "id"),
                    value: `${_.get(predictedPlayer, "firstName")} ${_.get(predictedPlayer, "lastName")}`,
                    teamId: _.get(predictedPlayer, "teamId"),
                };
            });

            const createAutomatedQuestionPayload = {
                channelId,
                questionGroupId,
                questionName,
                pointWeight: _.get(scheduledAutomatedQuestion, "pointValue"),
                statId: _.get(scheduledAutomatedQuestion, "statId"),
                automatedModeId: _.get(scheduledAutomatedQuestion, "automatedModeId"),
                automatedPeriodId: _.get(scheduledAutomatedQuestion, "automatedPeriodId"),
                gameId,
                questionType: "multi_choice",
                answersPayload: transformedPredictedPlayers,
            };

            const createdQuestion = await createAutomatedQuestion(createAutomatedQuestionPayload);
        });
    });
}

async function pullTop4PlayersPerStat(redisClient, game: NbaGame, statAbbrevs: string[]) {
    let homeTeamPlayers;
    let awayTeamPlayers;

    let topHomeTeamPlayers: { id: number; avg: number }[];
    let topAwayTeamPlayers: { id: number; avg: number }[];
    let allPlayerIds;
    let allPlayers;
    const topPlayersPerStat = {}; // { pts: [Player1, Player2], reb: ...}

    // await Bluebird.each(statAbbrevs, async stat => {
    const pstDate = moment.tz(_.get(game, "gameDatetime"), "America/Los_Angeles").format("YYYYMMDD");

    const homeTeamId = _.get(game, "homeTeamId");
    const awayTeamId = _.get(game, "awayTeamId");

    // Grabs redis keys from both teams to get Top 10 players per stat
    homeTeamPlayers = await hmgetRedisClient(redisClient, `teamId:${homeTeamId}:day:${pstDate}:top10`, statAbbrevs);
    awayTeamPlayers = await hmgetRedisClient(redisClient, `teamId:${awayTeamId}:day:${pstDate}:top10`, statAbbrevs);
    await Bluebird.each(statAbbrevs, async statAbbrev => {
        // Takes the top 2 of each stat from each team
        topHomeTeamPlayers = _.take(_.get(homeTeamPlayers, statAbbrev), 2);
        topAwayTeamPlayers = _.take(_.get(awayTeamPlayers, statAbbrev), 2);
        allPlayerIds = _.map(topHomeTeamPlayers, "id").concat(_.map(topAwayTeamPlayers, "id"));
        allPlayers = await getAllPlayersByIds(allPlayerIds); // Potential optimization is to pull all players per team and cache it in memory

        _.set(topPlayersPerStat, statAbbrev, allPlayers);
    });

    return topPlayersPerStat;
}

async function getGamesStartingBefore(date = new Date()) {
    const UTCString = date.toUTCString();
    return NbaGame.query()
        .where("status", "!=", "completed")
        .where("game_datetime", "<", UTCString);
}
