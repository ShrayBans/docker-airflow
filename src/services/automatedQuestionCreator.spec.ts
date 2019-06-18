import * as _ from "lodash";
import {
    Answer,
    Channel,
    createChannelData,
    createQuestionGroupData,
    NbaAutomatedAnswer,
    NbaAutomatedQuestion,
    NbaGame,
    Question,
    QuestionGroup,
} from "sixthman-objection-models";

import { RedisQueue } from "../lib/RedisQueue";
import { createAutomatedQuestion, generateQuestionName } from "./automatedQuestionCreator";
import {
    bootstrapNbaAutomatedMode,
    bootstrapNbaAutomatedPeriod,
    bootstrapNbaAutomatedStat,
    getNbaAutomatedModeId,
    getNbaAutomatedPeriodId,
    getNbaAutomatedStatId,
} from "../test/fixtures/nbaDimensions";
import { bootstrapNbaGame, bootstrapNbaPlayer, bootstrapNbaTeam } from "../test/fixtures/nbaGames";
//@ts-ignore
import * as warriorsLakersPredictions from "../test/resources/warriors-lakers-predictions.json";

jest.mock("./pullPredictionStats", () => ({
    pullTop4PlayersPerStat: jest.fn().mockImplementation(() => Promise.resolve(warriorsLakersPredictions)),
}));

describe("Automated Question Creator", async () => {
    let count = 0;
    const redisQueueName = "test-queue";
    let redisQueue;
    let channel;
    let channelId;
    let questionGroup;
    let questionGroupId;
    let nbaGame;

    beforeAll(async () => {
        redisQueue = new RedisQueue("127.0.0.1", 6379);
        await bootstrapNbaTeam();
        await bootstrapNbaGame();
        await bootstrapNbaPlayer();
    });
    beforeEach(async () => {
        await bootstrapNbaAutomatedMode();
        await bootstrapNbaAutomatedPeriod();
        await bootstrapNbaAutomatedStat();
        channel = await Channel.query().insert(createChannelData({ name: "Test Channel" }));
        channelId = _.get(channel, "id");
        questionGroup = await QuestionGroup.query().insert({
            ...createQuestionGroupData({ channelId: channel.id, name: "Test Question Group" }),
            nbaGameId: 21800500,
        });
        questionGroupId = _.get(questionGroup, "id");
        nbaGame = await NbaGame.query().findById(21800500);
    });

    describe("#createAutomatedQuestion", async () => {
        it("Creates Question and Automated Question", async () => {
            const createAutomatedQuestionPayload = {
                channelId,
                questionGroupId,
                questionName: "AUTOMATED: Who will have the most free throws in the 1st quarter?",
                pointWeight: 10,
                statId: await getNbaAutomatedStatId("free_throw"),
                automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                gameId: 21800500,
                questionType: "multi_choice",
                answersPayload: [
                    {
                        value: "LeBron James",
                        playerId: 2544,
                        teamId: 1610612747,
                    },
                    {
                        value: "Stephen Curry",
                        playerId: 201939,
                        teamId: 1610612744,
                    },
                    {
                        value: "Kevin Durant",
                        playerId: 201142,
                        teamId: 1610612744,
                    },
                    {
                        value: "Andre Iguodala",
                        playerId: 2738,
                        teamId: 1610612744,
                    },
                ],
            };

            const { nbaAutomatedQuestion, id: createdQuestionId } = await createAutomatedQuestion(
                createAutomatedQuestionPayload
            );

            const automatedQuestions = await NbaAutomatedQuestion.query().where({
                id: _.get(nbaAutomatedQuestion, "id"),
            });
            const question = await Question.query().where({
                question_group_id: questionGroupId,
            });

            expect(automatedQuestions).toHaveLength(1);
            expect(_.head(question).id).toEqual(createdQuestionId);

            expect(question).toHaveLength(1);
            expect(_.head(automatedQuestions).id).toEqual(_.get(nbaAutomatedQuestion, "id"));
        });

        it("Creates Answers and Automated Answers", async () => {
            const createAutomatedQuestionPayload = {
                channelId,
                questionGroupId,
                questionName: "AUTOMATED: Who will have the most free throws in the 1st quarter?",
                pointWeight: 10,
                statId: await getNbaAutomatedStatId("free_throw"),
                automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                gameId: 21800500,
                questionType: "multi_choice",
                answersPayload: [
                    {
                        value: "LeBron James",
                        playerId: 2544,
                        teamId: 1610612747,
                    },
                    {
                        value: "Stephen Curry",
                        playerId: 201939,
                        teamId: 1610612744,
                    },
                    {
                        value: "Kevin Durant",
                        playerId: 201142,
                        teamId: 1610612744,
                    },
                    {
                        value: "Andre Iguodala",
                        playerId: 2738,
                        teamId: 1610612744,
                    },
                ],
            };

            const { nbaAutomatedQuestion, id: createdQuestionId } = await createAutomatedQuestion(
                createAutomatedQuestionPayload
            );

            const automatedAnswers = await NbaAutomatedAnswer.query().where({
                automated_question_id: _.get(nbaAutomatedQuestion, "id"),
            });
            expect(automatedAnswers).toHaveLength(4);
            expect(_.head(automatedAnswers).automatedQuestionId).toEqual(nbaAutomatedQuestion.id);

            const answers = await Answer.query().where({
                question_id: createdQuestionId,
            });
            expect(answers).toHaveLength(4);
            expect(_.head(answers).questionId).toEqual(createdQuestionId);
        });

        it("Question Name Generation", async () => {
            const createAutomatedQuestionPayload = {
                channelId,
                questionGroupId,
                pointWeight: 10,
                statId: await getNbaAutomatedStatId("free_throw"),
                automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                gameId: 21800500,
                questionType: "multi_choice",
                answersPayload: [
                    {
                        value: "LeBron James",
                        playerId: 2544,
                        teamId: 1610612747,
                    },
                    {
                        value: "Stephen Curry",
                        playerId: 201939,
                        teamId: 1610612744,
                    },
                    {
                        value: "Kevin Durant",
                        playerId: 201142,
                        teamId: 1610612744,
                    },
                    {
                        value: "Andre Iguodala",
                        playerId: 2738,
                        teamId: 1610612744,
                    },
                ],
            };

            const { nbaAutomatedQuestion, id: createdQuestionId } = await createAutomatedQuestion(
                createAutomatedQuestionPayload
            );

            const automatedQuestion = await NbaAutomatedQuestion.query().findOne({
                id: _.get(nbaAutomatedQuestion, "id"),
            });
            const question = await Question.query().findOne({
                id: createdQuestionId,
            });
            const automatedQuestionName = _.get(automatedQuestion, "description");
            const questionName = _.get(question, "name");

            expect(automatedQuestionName).toEqual("Who will get the most free throws over the entire game?");
            expect(questionName).toEqual("Who will get the most free throws over the entire game?");
        });
    });
    describe("#generateQuestionName", async () => {
        it("Free Throw x Greatest Total Stat x Full Game", async () => {
            const statId = await getNbaAutomatedStatId("free_throw");
            const automatedModeId = await getNbaAutomatedModeId("greatest_total_stat");
            const automatedPeriodId = await getNbaAutomatedPeriodId("full_game");

            const questionName = await generateQuestionName(statId, automatedModeId, automatedPeriodId);
            expect(questionName).toEqual("Who will get the most free throws over the entire game?");
        });
        it("Points x Greatest Total Stat x Full Game", async () => {
            const statId = await getNbaAutomatedStatId("points");
            const automatedModeId = await getNbaAutomatedModeId("greatest_total_stat");
            const automatedPeriodId = await getNbaAutomatedPeriodId("full_game");

            const questionName = await generateQuestionName(statId, automatedModeId, automatedPeriodId);
            expect(questionName).toEqual("Who will get the most points over the entire game?");
        });
        it("Free Throw x Lowest Total Stat x Full Game", async () => {
            const statId = await getNbaAutomatedStatId("free_throw");
            const automatedModeId = await getNbaAutomatedModeId("lowest_total_stat");
            const automatedPeriodId = await getNbaAutomatedPeriodId("full_game");

            const questionName = await generateQuestionName(statId, automatedModeId, automatedPeriodId);
            expect(questionName).toEqual("Who will get the least free throws over the entire game?");
        });
        it("Free Throw x Greatest Total Stat x First Half", async () => {
            const statId = await getNbaAutomatedStatId("free_throw");
            const automatedModeId = await getNbaAutomatedModeId("greatest_total_stat");
            const automatedPeriodId = await getNbaAutomatedPeriodId("first_half");

            const questionName = await generateQuestionName(statId, automatedModeId, automatedPeriodId);
            expect(questionName).toEqual("Who will get the most free throws in the first half?");
        });
        it("Free Throw Percentage x Greatest Total Stat x Full Game", async () => {
            const statId = await getNbaAutomatedStatId("free_throw_pct");
            const automatedModeId = await getNbaAutomatedModeId("greatest_total_stat");
            const automatedPeriodId = await getNbaAutomatedPeriodId("full_game");

            const questionName = await generateQuestionName(statId, automatedModeId, automatedPeriodId);
            expect(questionName).toEqual("Who will get the highest FT percentage over the entire game?");
        });
        it("Free Throw x Greatest Total Stat x Full Game", async () => {
            const statId = await getNbaAutomatedStatId("free_throw");
            const automatedModeId = await getNbaAutomatedModeId("first_stat");
            const automatedPeriodId = await getNbaAutomatedPeriodId("first_quarter");

            const questionName = await generateQuestionName(statId, automatedModeId, automatedPeriodId);
            expect(questionName).toEqual("Who will be the first to get a free throw in the first quarter?");
        });
    });
});
