import * as Bluebird from "bluebird";
import * as _ from "lodash";
import {
    NbaStat,
    Question,
    QuestionGroup,
    ScheduledNbaAutomatedQuestion,
    ScheduledNbaAutomatedQuestionOfDay,
} from "sixthman-objection-models";
import { pullTop4PlayersPerStat } from "../services/pullPredictionStats";
import { createAutomatedQuestion } from "./automatedQuestionCreator";

/**
 * Entry point which creates all scheduled questions given a game and the current parsed quarter beginning
 * @param redisClient
 * @param game
 * @param nbaStatAbbrevs
 * @param quarterTrigger
 */
export async function createScheduledQuestionsPerGame(redisClient, game, quarterTrigger) {
    const nbaStats = await NbaStat.query();
    const nbaStatAbbrevs = _.map(nbaStats, "abbrev");
    const gameId: number = _.get(game, "id");

    const topPlayersPerStat = await pullTop4PlayersPerStat(redisClient, game, nbaStatAbbrevs);
    await createQuestionsPerGameTrigger(gameId, topPlayersPerStat, quarterTrigger);
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
