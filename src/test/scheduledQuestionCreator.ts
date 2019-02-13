import * as Bluebird from "bluebird";
import * as _ from "lodash";
import * as moment from "moment-timezone";
import {
    NbaGame,
    NbaStat,
    Question,
    QuestionGroup,
    ScheduledNbaAutomatedQuestion,
    ScheduledNbaAutomatedQuestionOfDay,
} from "sixthman-objection-models";

import { createRedisClient } from "../lib/redisClient";
import { singlePromise } from "../lib/runUtils";
import { createAutomatedQuestion } from "./automatedQuestionCreator";
import { pullTop4PlayersPerStat } from "./pullPredictionStats";

const { instantiateKnex } = require("../lib/knex.js");
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

// runScript(scheduledQuestionCreator);

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

            await createQuestionsPerGameTrigger(gameId, topPlayersPerStat, quarterTrigger);
        });

        // console.log("gameByStatByPlayerMap", gameByStatByPlayerMap);
    };

    await singlePromise(mainCallback);
}

async function getAllScheduledAutomatedQuestions(gameId, channelId, quarterTrigger) {
    const scheduledQuestions = await ScheduledNbaAutomatedQuestion.query()
        .whereNull("channel_id")
        .orWhere("channel_id", channelId) // Channel ID is used for channel specific scheduled questions
        .eager(`[stat, automatedPeriod, automatedMode]`);

    const scheduledQuestionsOfDay = await ScheduledNbaAutomatedQuestionOfDay.query()
        .where("game_id", gameId) // Game ID is used for game specific scheduled questions
        .eager(`[stat, automatedPeriod, automatedMode]`);

    const allScheduledQuestions = _.concat(scheduledQuestionsOfDay, scheduledQuestions);

    const filteredScheduledQuestions = _.filter(allScheduledQuestions, scheduledQuestion => {
        return _.get(scheduledQuestion, ["automatedPeriod", "quarterTrigger"]) === quarterTrigger;
    });

    return filteredScheduledQuestions;
    // join to automated_period and match up quarter_trigger
}

/**
 * 1. Pulls all scheduled automated questions to be created associated with the corresponding quarterTrigger (i.e. "pregame")
 * 2. Uses the scheduled automated questions to determine what stat x mode x period to and formats a questionName based on it
 * 3. Pulls top 4 player stats based on the gameId and the stat pulled (pts, gsw vs lakers) -> KD, Steph, Lebron, Kuzma
 * 4. Defaults questionType to multiple_choice
 * 5. Creates questions based on previous fields
 */
export async function createQuestionsPerGameTrigger(gameId, topStats, quarterTrigger = "pregame"): Promise<Question[]> {
    const questionGroups = await QuestionGroup.query().where("nba_game_id", gameId);
    // Creates a question per question group - TODO: Remove to make it one question group per

    const createdQuestions: Question[] = [];

    await Bluebird.each(questionGroups, async questionGroup => {
        const questionGroupId = _.get(questionGroup, "id");
        const channelId = _.get(questionGroup, "channelId");

        const scheduledAutomatedQuestions: ScheduledNbaAutomatedQuestion[] = await getAllScheduledAutomatedQuestions(
            gameId,
            channelId,
            quarterTrigger
        );

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
                questionName:
                    _.size(_.get(scheduledAutomatedQuestion, "overwriteName")) > 0
                        ? _.get(scheduledAutomatedQuestion, "overwriteName")
                        : undefined,
                channelId,
                questionGroupId,
                pointWeight: _.get(scheduledAutomatedQuestion, "pointValue"),
                statId: _.get(scheduledAutomatedQuestion, "statId"),
                automatedModeId: _.get(scheduledAutomatedQuestion, "automatedModeId"),
                automatedPeriodId: _.get(scheduledAutomatedQuestion, "automatedPeriodId"),
                gameId,
                questionType: "multi_choice",
                answersPayload: transformedPredictedPlayers,
            };

            const createdQuestion: Question = await createAutomatedQuestion(createAutomatedQuestionPayload);
            createdQuestions.push(createdQuestion);
        });
    });

    return createdQuestions;
}

async function getGamesStartingBefore(date = new Date()) {
    const UTCString = date.toUTCString();
    return NbaGame.query()
        .where("status", "!=", "completed")
        .where("game_datetime", "<", UTCString);
}
