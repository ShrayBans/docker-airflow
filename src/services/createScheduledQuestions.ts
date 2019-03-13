import * as Bluebird from "bluebird";
import * as _ from "lodash";
import {
    NbaGame,
    NbaStat,
    Question,
    QuestionGroup,
    ScheduledNbaAutomatedAnswer,
    ScheduledNbaAutomatedQuestion,
} from "sixthman-objection-models";

import { pullTop4PlayersPerStat } from "../services/pullPredictionStats";
import { createAutomatedQuestion } from "./automatedQuestionCreator";
import * as moment from 'moment-timezone';

/**
 * Entry point which creates all scheduled questions given a game and the current parsed quarter beginning
 * @param redisClient
 * @param game
 * @param nbaStatAbbrevs
 * @param quarterTrigger
 */
export async function createScheduledQuestionsPerGame(redisClient, quarterTrigger, game?: NbaGame) {
    const nbaStats = await NbaStat.query();
    const nbaStatAbbrevs = _.map(nbaStats, "abbrev");
    const gameId: number = _.get(game, "id");

    const topPlayersPerStat = await pullTop4PlayersPerStat(redisClient, game, nbaStatAbbrevs);
    await createQuestionsPerGameTrigger(gameId, topPlayersPerStat, quarterTrigger);
}

export async function getAllScheduledAutomatedQuestions(quarterTrigger, channelId) {
    // If both channel and date, then has to check on date
    const currentDateString = moment
            .tz(
                moment(new Date())
                    .toDate(),
                "America/Los_Angeles"
            )
            .format("YYYYMMDD");
    const scheduledQuestions = await ScheduledNbaAutomatedQuestion.query()
        .where("posted", "!=", true)
        .where(builder => {
            builder.orWhereNull("channel_id")
            builder.orWhere(innerBuilder => {
                innerBuilder.where("channel_id", channelId) // Channel ID is used for channel specific scheduled questions
                innerBuilder.where("post_date", currentDateString)
            })
            builder.orWhere(innerBuilder => {
                innerBuilder.where("channel_id", channelId) // Channel ID is used for channel specific scheduled questions
                innerBuilder.whereNull("post_date")
            })
        })
        .eager(`[stat, automatedPeriod, automatedMode]`)

    // const scheduledQuestionsOfDay = await ScheduledNbaAutomatedQuestionOfDay.query()
    //     .where("game_id", gameId) // Game ID is used for game specific scheduled questions
    //     .eager(`[stat, automatedPeriod, automatedMode]`);

    // const allScheduledQuestions = _.concat(scheduledQuestionsOfDay, scheduledQuestions);
    const filteredScheduledQuestions = _.filter(scheduledQuestions, scheduledQuestion => {
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

    let createdQuestions: Question[] = [];

    await Bluebird.each(questionGroups, async questionGroup => {
        const questionGroupId = _.get(questionGroup, "id");
        const channelId = _.get(questionGroup, "channelId");

        const createdScheduledQuestions = await createScheduledQuestions(quarterTrigger, channelId, questionGroupId, gameId, topStats)

        createdQuestions = createdQuestions.concat(createdScheduledQuestions);

    });

    return createdQuestions;
}

/**
 * Entrypoint for creating a question per channel
 * @param gameId
 * @param topStats
 * @param quarterTrigger
 */
export async function createQuestionsPerChannel(quarterTrigger = "pregame", channelId: number, gameId?: number, topStats?): Promise<Question[]> {
    const latestQuestionGroup: QuestionGroup = await QuestionGroup.query()
        .where({
            channel_id: channelId,
        })
        .orderBy("created_at", "desc")
        .eager("nbaGame")
        .first();
    const questionGroupId = _.get(latestQuestionGroup, "id");

    const createdScheduledQuestions =  await createScheduledQuestions(quarterTrigger, channelId, questionGroupId, gameId, topStats)

    return createdScheduledQuestions;
}
/**
 *
 * @param quarterTrigger
 * @param channelId
 * @param questionGroupId
 * @param gameId NOTE: Without this, questions cannot be answered automatically
 * @param topStats NOTE: Without this, questions cannot be answered automatically
 */
export async function createScheduledQuestions(quarterTrigger: string, channelId: number, questionGroupId: number, gameId?: number, topStats?): Promise<Question[]> {
    const scheduledAutomatedQuestions: ScheduledNbaAutomatedQuestion[] = await getAllScheduledAutomatedQuestions(
        quarterTrigger,
        channelId,
    );
    console.log('scheduledAutomatedQuestions', scheduledAutomatedQuestions);

    return Bluebird.map(scheduledAutomatedQuestions, async (scheduledAutomatedQuestion: ScheduledNbaAutomatedQuestion) => {
        // Checks to see if there are any scheduledQuestions with answers
        const scheduledAutomatedOverwrite = await scheduledAutomatedQuestion.$query().innerJoinRelation("scheduledAutomatedAnswers").count();
        const scheduledAutomatedAnswers = await ScheduledNbaAutomatedAnswer.query().where("scheduled_automated_question_id", scheduledAutomatedQuestion.id)
        const hasScheduledAnswers = Number(_.get(scheduledAutomatedOverwrite, "count", 0)) > 0;

        // If there are ScheduledAnswers, takes them otherwise defaults to predicting them
        const predictedPlayers = _.get(topStats, _.get(scheduledAutomatedQuestion, ["stat", "abbrev"]), []);
        const answersPayload = hasScheduledAnswers ?
            _.map(scheduledAutomatedAnswers, (scheduledAnswers: ScheduledNbaAutomatedAnswer) => {
                return {
                    value: scheduledAnswers.value,
                    status: scheduledAnswers.status,
                };
            }) :
            _.map(predictedPlayers, predictedPlayer => {
                return {
                    playerId: _.get(predictedPlayer, "id"),  // Transforms id into playerId
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
            questionType: _.get(scheduledAutomatedQuestion, "questionType", "multi_choice"),
            pointWeight: _.get(scheduledAutomatedQuestion, "pointValue"),
            statId: _.get(scheduledAutomatedQuestion, "statId"),
            automatedModeId: _.get(scheduledAutomatedQuestion, "automatedModeId"),
            automatedPeriodId: _.get(scheduledAutomatedQuestion, "automatedPeriodId"),
            gameId,
            answersPayload,
        };

        const createdQuestion: Question = await createAutomatedQuestion(createAutomatedQuestionPayload);

        return createdQuestion;
    });
}