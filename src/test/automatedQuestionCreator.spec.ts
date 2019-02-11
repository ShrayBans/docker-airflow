import * as _ from "lodash";
import {
    Answer,
    Channel,
    createChannelData,
    createQuestionGroupData,
    NbaAutomatedAnswer,
    NbaAutomatedQuestion,
    Question,
    QuestionGroup,
} from "sixthman-objection-models";

import { RedisQueue } from "../lib/RedisQueue";
import { createAutomatedQuestion } from "./automatedQuestionCreator";
import { fakeGameRunner } from "./fakeGameRunner";
import {
    bootstrapNbaAutomatedMode,
    bootstrapNbaAutomatedPeriod,
    bootstrapNbaAutomatedStat,
    getNbaAutomatedModeId,
    getNbaAutomatedPeriodId,
    getNbaAutomatedStatId,
} from "./fixtures/nbaDimensions";
import { bootstrapNbaAutomatedGame, bootstrapNbaAutomatedPlayer, bootstrapNbaAutomatedTeam } from "./fixtures/nbaGames";

describe("Question Group Services", async () => {
    let count = 0;
    const redisQueueName = "test-queue";
    let redisQueue;
    let channel;
    let channelId;
    let questionGroup;
    let questionGroupId;

    beforeAll(async () => {
        redisQueue = new RedisQueue("127.0.0.1", 6379);
        await bootstrapNbaAutomatedMode();
        await bootstrapNbaAutomatedPeriod();
        await bootstrapNbaAutomatedStat();
        await bootstrapNbaAutomatedTeam();
        await bootstrapNbaAutomatedGame();
        await bootstrapNbaAutomatedPlayer();
    });
    beforeEach(async () => {
        channel = await Channel.query().insert(createChannelData({ name: "Test Channel" }));
        channelId = _.get(channel, "id");
        questionGroup = await QuestionGroup.query().insert(
            createQuestionGroupData({ channelId: channel.id, name: "Test Question Group" })
        );
        questionGroupId = _.get(questionGroup, "id");

        await fakeGameRunner(redisQueueName, "./resources/warriors-lakers.json");
    });

    describe("Automated Question and Answer Saving", async () => {
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
            expect(automatedQuestions).toHaveLength(1);
            expect(_.head(automatedQuestions).id).toEqual(createdQuestionId);

            const question = await Question.query().where({
                question_group_id: questionGroupId,
            });
            expect(question).toHaveLength(1);
            expect(_.head(question).id).toEqual(_.get(nbaAutomatedQuestion, "id"));
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
            console.log("automatedAnswers", automatedAnswers);
            expect(automatedAnswers).toHaveLength(4);
            expect(_.head(automatedAnswers).automatedQuestionId).toEqual(nbaAutomatedQuestion.id);

            const answers = await Answer.query().where({
                question_id: createdQuestionId,
            });
            expect(answers).toHaveLength(4);
            expect(_.head(answers).questionId).toEqual(createdQuestionId);
        });

        it.only("Question Name Generation", async () => {
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

            const automatedQuestion = await NbaAutomatedQuestion.query().where({
                id: _.get(nbaAutomatedQuestion, "id"),
            });
            const question = await Question.query().findOne({
                id: createdQuestionId,
            });

            const name = _.get(question, "name");
            console.log("name", name);
        });
    });
});
