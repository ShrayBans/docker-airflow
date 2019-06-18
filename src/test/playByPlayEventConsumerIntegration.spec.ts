import * as _ from "lodash";
import {
    Channel,
    createChannelData,
    createQuestionGroupData,
    NbaAutomatedAnswer,
    Question,
    QuestionGroup,
} from "sixthman-objection-models";

import { createRedisClient } from "../lib/redisClient";
import { RedisQueue } from "../lib/RedisQueue";
import { createAutomatedQuestion } from "../services/automatedQuestionCreator";
import { createQuestionsPerGameTrigger } from "../services/createScheduledQuestions";
import { evaluateNbaEventMessage } from "../services/evaluateNbaEventMessage";
import { fakeGameRunner } from "./fakeGameRunner";
import {
    bootstrapNbaAutomatedMode,
    bootstrapNbaAutomatedPeriod,
    bootstrapNbaAutomatedStat,
    bootStrapScheduledQuestionOfDay,
    bootstrapScheduledQuestions,
    getNbaAutomatedModeId,
    getNbaAutomatedPeriodId,
    getNbaAutomatedStatId,
} from "./fixtures/nbaDimensions";
import { bootstrapNbaGame, bootstrapNbaPlayer, bootstrapNbaTeam } from "./fixtures/nbaGames";
//@ts-ignore
import * as warriorsLakersPredictions from "../test/resources/warriors-lakers-predictions.json";


jest.mock("../services/pullPredictionStats", () => ({
    pullTop4PlayersPerStat: jest.fn().mockImplementation(() => Promise.resolve(warriorsLakersPredictions)),
}));

describe("Play By Play Event Consumer", async () => {
    let count = 0;
    const redisQueueName = "test-queue";
    let nbaGameId;
    let redisClient;
    let redisQueue;
    let channel;
    let channelId;
    let questionGroup;
    let questionGroupId;

    beforeAll(async () => {
        redisQueue = new RedisQueue("127.0.0.1", 6379);
        redisClient = createRedisClient("127.0.0.1", 6379);
        await bootstrapNbaTeam();
        await bootstrapNbaGame();
        await bootstrapNbaPlayer();
    });
    beforeEach(async () => {
        await bootstrapNbaAutomatedMode();
        await bootstrapNbaAutomatedPeriod();
        await bootstrapNbaAutomatedStat();
        nbaGameId = 21800500;
        channel = await Channel.query().insert(createChannelData({ name: "Test Channel" }));
        channelId = _.get(channel, "id");
        questionGroup = await QuestionGroup.query().insert({
            ...createQuestionGroupData({ channelId: channel.id, name: "Test Question Group" }),
            nbaGameId,
        });
        questionGroupId = _.get(questionGroup, "id");

        await fakeGameRunner(redisQueueName, "./resources/warriors-lakers.json");
    });
    describe("Automated Question Creation", async () => {
        describe("ScheduledQuestion - Creates Question and Automated Question and Formats Name Correctly", async () => {
            it("greatest_total_stat x full_game x free_throw_pct", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 123,
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("second_quarter"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 100);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
                expect(_.head(question).pointWeight).toEqual(123);
                expect(_.head(question).name).toEqual("Who will get the highest FT percentage in the second quarter?");
            });
            it("lowest_total_stat x third_quarter x free_throw_pct", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        automatedModeId: await getNbaAutomatedModeId("lowest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("third_quarter"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 100);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
                expect(_.head(question).name).toEqual("Who will get the lowest FT percentage in the third quarter?");
            });
        });

        // Removed ScheduledQuestionOfDay functionality
        describe.skip("ScheduledQuestionOfDay - Creates Question and Automated Question and Formats Name Correctly", async () => {
            it("greatest_total_stat x second_half x free_throw_pct", async () => {
                await bootStrapScheduledQuestionOfDay([
                    {
                        pointValue: 100,
                        overwriteName: "Example question?",
                        gameId: nbaGameId,
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("second_half"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 100);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
                expect(_.head(question).pointWeight).toEqual(100);
                expect(_.head(question).name).toEqual("Example question?");
            });
            it("greatest_total_stat x second_half x free_throw_pct", async () => {
                await bootStrapScheduledQuestionOfDay([
                    {
                        pointValue: 100,
                        gameId: nbaGameId,
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("second_half"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 100);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
                expect(_.head(question).name).toEqual("Who will get the highest FT percentage in the second half?");
            });
        });
    });

    describe("Automated Question Answering", async () => {
        describe("Points", async () => {
            it("Full Game", async () => {
                const createAutomatedQuestionPayload = {
                    channelId,
                    questionGroupId,
                    questionName: "AUTOMATED: Who will have the most points in the 3rd quarter?",
                    pointWeight: 10,
                    statId: await getNbaAutomatedStatId("points"),
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);
                // console.log("nbaAutomatedQuestion", nbaAutomatedQuestion);
                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });
                // console.log("automatedAnswers", automatedAnswers);
                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(23);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(17);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(15);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(21);
                    }
                });
            });
            it("First Quarter", async () => {
                const createAutomatedQuestionPayload = {
                    channelId,
                    questionGroupId,
                    questionName: "AUTOMATED: Who will have the most points in the 3rd quarter?",
                    pointWeight: 10,
                    statId: await getNbaAutomatedStatId("points"),
                    automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                    automatedPeriodId: await getNbaAutomatedPeriodId("first_quarter"),
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });

                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(5);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(8);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(4);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(8);
                    }
                });
            });
            it("Second Half", async () => {
                const createAutomatedQuestionPayload = {
                    channelId,
                    questionGroupId,
                    questionName: "AUTOMATED: Who will have the most points in the 3rd quarter?",
                    pointWeight: 10,
                    statId: await getNbaAutomatedStatId("points"),
                    automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                    automatedPeriodId: await getNbaAutomatedPeriodId("second_half"),
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });
                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(7);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(0);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(9);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(12);
                    }
                });
            });
        });

        describe("Rebounds", async () => {
            it("Full Game", async () => {
                const createAutomatedQuestionPayload = {
                    channelId,
                    questionGroupId,
                    questionName: "AUTOMATED: Who will have the most rebounds in the 3rd quarter?",
                    pointWeight: 10,
                    statId: await getNbaAutomatedStatId("rebound"),
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });

                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(5);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(13);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(2);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(7);
                    }
                });
            });
            it("First Quarter", async () => {
                const createAutomatedQuestionPayload = {
                    channelId,
                    questionGroupId,
                    questionName: "AUTOMATED: Who will have the most rebounds in the 3rd quarter?",
                    pointWeight: 10,
                    statId: await getNbaAutomatedStatId("rebound"),
                    automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                    automatedPeriodId: await getNbaAutomatedPeriodId("first_quarter"),
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });

                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(1);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(5);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(0);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(4);
                    }
                });
            });
            it("Second Half", async () => {
                const createAutomatedQuestionPayload = {
                    channelId,
                    questionGroupId,
                    questionName: "AUTOMATED: Who will have the most rebounds in the 3rd quarter?",
                    pointWeight: 10,
                    statId: await getNbaAutomatedStatId("rebound"),
                    automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                    automatedPeriodId: await getNbaAutomatedPeriodId("second_half"),
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });
                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(2);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(3);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(2);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(2);
                    }
                });
            });
        });

        describe("Free Throws", async () => {
            it("Full Game", async () => {
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });

                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(2);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(5);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(3);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(8);
                    }
                });
            });
        });

        describe("Field Goals", async () => {
            it("Full Game", async () => {
                const createAutomatedQuestionPayload = {
                    channelId,
                    questionGroupId,
                    questionName: "AUTOMATED: Who will have the most field goals in the 1st quarter?",
                    pointWeight: 10,
                    statId: await getNbaAutomatedStatId("field_goal"),
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });

                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(6);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(6);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(3);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(2);
                    }
                });
            });
        });

        describe("Three Pointers", async () => {
            it("Full Game", async () => {
                const createAutomatedQuestionPayload = {
                    channelId,
                    questionGroupId,
                    questionName: "AUTOMATED: Who will have the most three pointers in the 1st quarter?",
                    pointWeight: 10,
                    statId: await getNbaAutomatedStatId("three_pointer"),
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

                const { nbaAutomatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

                await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage(redisClient), 10);

                const automatedAnswers = await NbaAutomatedAnswer.query().where({
                    automated_question_id: _.get(nbaAutomatedQuestion, "id"),
                });

                _.forEach(automatedAnswers, automatedAnswer => {
                    if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(3);
                    } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(0);
                    } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(2);
                    } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                        expect(_.get(automatedAnswer, "statValue")).toEqual(3);
                    }
                });
            });
        });
    });
});
