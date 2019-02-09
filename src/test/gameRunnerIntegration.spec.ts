import * as _ from 'lodash';
import {
    Channel,
    createChannelData,
    createQuestionGroupData,
    NbaAutomatedAnswer,
    NbaPlayByPlay,
    QuestionGroup,
} from 'sixthman-objection-models';

import { evaluateNbaEventMessage } from '../load_jobs/question_answer_runner';
import { createAutomatedQuestion } from './automatedQuestionCreator';
import { fakeGameRunner } from './fakeGameRunner';
import {
    bootstrapNbaAutomatedMode,
    bootstrapNbaAutomatedPeriod,
    bootstrapNbaAutomatedStat,
    getNbaAutomatedModeId,
    getNbaAutomatedPeriodId,
    getNbaAutomatedStatId,
} from './fixtures/nbaDimensions';
import { bootstrapNbaAutomatedGame, bootstrapNbaAutomatedPlayer, bootstrapNbaAutomatedTeam } from './fixtures/nbaGames';

const RedisQueue = require("../lib/redis-queue");

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

            const automatedAnswers = await NbaAutomatedAnswer.query().where({
                automated_question_id: _.get(nbaAutomatedQuestion, "id"),
            });

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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

            await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

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
});
