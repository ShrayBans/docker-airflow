import * as _ from "lodash";
import {
    Channel,
    createChannelData,
    createQuestionGroupData,
    NbaGame,
    Question,
    QuestionGroup,
    ScheduledNbaAutomatedAnswer,
} from "sixthman-objection-models";

import { RedisQueue } from "../lib/RedisQueue";
import { createQuestionsPerGameTrigger, createQuestionsPerChannel, getAllScheduledAutomatedQuestions } from "../services/createScheduledQuestions";
import {
    bootstrapNbaAutomatedMode,
    bootstrapNbaAutomatedPeriod,
    bootstrapNbaAutomatedStat,
    bootStrapScheduledQuestionOfDay,
    bootstrapScheduledQuestions,
    getNbaAutomatedModeId,
    getNbaAutomatedPeriodId,
    getNbaAutomatedStatId,
    bootstrapScheduledAnswers,
} from "../test/fixtures/nbaDimensions";
import { bootstrapNbaGame, bootstrapNbaPlayer, bootstrapNbaTeam } from "../test/fixtures/nbaGames";
// @ts-ignore
import * as warriorsLakersPredictions from "../test/resources/warriors-lakers-predictions.json";
import { pullTop4PlayersPerStat } from "./pullPredictionStats";
import * as moment from 'moment-timezone';

jest.mock("./pullPredictionStats", () => ({
    pullTop4PlayersPerStat: jest.fn().mockImplementation(() => Promise.resolve(warriorsLakersPredictions)),
}));

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

describe("Create Scheduled Questions", async () => {
    let count = 0;
    const redisQueueName = "test-queue";
    let redisQueue;
    let channel;
    let channelId;
    let questionGroup;
    let questionGroupId;
    let nbaGame;
    let nbaGameId;
    let topStats;

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
        nbaGameId = 21800500;
        topStats = await pullTop4PlayersPerStat(1, nbaGame, ["joshsucks"]);
    });

    describe("#pullTop4PlayersPerStat", async () => {
        it("Pulls top prediction stats for game 21800500 cached in ./resources/warriors-lakers-predictions.json", async () => {
            // console.log("topStats", JSON.stringify(stats));
            expect(_.size(topStats)).toBeGreaterThan(1);
        });
    });

    describe("#createQuestionsPerChannel", async () => {
        describe("ScheduledQuestion - Creates Question without Automated Stat Fields", async () => {
            it("No Scheduled Answers Fails", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        overwriteName: "Test Name",
                        automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                    },
                ]);
                const quarterTrigger = "pregame";
                await createQuestionsPerChannel(quarterTrigger, channelId);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });

                expect(question).toHaveLength(0);
            });
            it("No overwrite name fails", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                    },
                ]);
                const quarterTrigger = "pregame";
                await createQuestionsPerChannel(quarterTrigger, channelId);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });

                expect(question).toHaveLength(0);
            });
            it("Scheduled Answers with Overwrite name succeeds", async () => {
                const quarterTrigger = "pregame";
                const [{ id: scheduledAutomatedQuestionId }] = await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        overwriteName: "Test Name",
                        automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                    },
                ]);

                await bootstrapScheduledAnswers([
                    {
                        scheduledAutomatedQuestionId,
                        value: "Shray Test Answer 1",
                        status: "open"
                    },
                    {
                        scheduledAutomatedQuestionId,
                        value: "Shray Test Answer 2",
                        status: "open"
                    }
                ])
                const createdQuestions = await createQuestionsPerChannel(quarterTrigger, channelId);
                const createdQuestionId = _.get(_.head(createdQuestions), "id");

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
                expect(_.head(question).id).toEqual(createdQuestionId);
                expect(_.head(question).name).toEqual("Test Name");
            });
        });
    });

    describe("#getAllScheduledAutomatedQuestions", async () => {
        describe("Can get Scheduled Questions", async () => {
            it("when there is a channelId and no postDate", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        overwriteName: "Test Name",
                        automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                        channelId
                    },
                ]);

                const scheduledQuestions = await getAllScheduledAutomatedQuestions("pregame", channelId)
                expect(scheduledQuestions).toHaveLength(1);
            });
            it("according to the associated quarterTrigger 'first_quarter'", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        overwriteName: "Test Name",
                        automatedPeriodId: await getNbaAutomatedPeriodId("second_quarter"),
                        channelId
                    },
                ]);

                const scheduledQuestions = await getAllScheduledAutomatedQuestions("first_quarter", channelId)
                expect(scheduledQuestions).toHaveLength(1);
            });
            it("when it is the current date", async () => {
                const currentDateString = moment.tz(
                    moment(new Date())
                        .toDate(),
                    "America/Los_Angeles"
                )
                .format("YYYYMMDD");
                // console.log('currentDateString', currentDateString);

                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        overwriteName: "Test Name",
                        automatedPeriodId: await getNbaAutomatedPeriodId("second_quarter"),
                        channelId,
                        postDate: currentDateString
                    },
                ]);

                const scheduledQuestions = await getAllScheduledAutomatedQuestions("first_quarter", channelId)
                expect(scheduledQuestions).toHaveLength(1);
            });
            it("not when there is not automatedPeriod associated", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);

                const scheduledQuestions = await getAllScheduledAutomatedQuestions("pregame", channelId)
                expect(scheduledQuestions).toHaveLength(0);
            });
            it("not when a question has already been posted", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                        posted: true,
                    },
                ]);

                const scheduledQuestions = await getAllScheduledAutomatedQuestions("pregame", channelId)
                expect(scheduledQuestions).toHaveLength(0);
            });
        });
    })

    describe("#createQuestionsPerGameTrigger", async () => {
        describe("ScheduledQuestion - Creates Question and Automated Question and Formats Name Correctly", async () => {
            it("greatest_total_stat x full_game x free_throw_pct", async () => {
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                const quarterTrigger = "pregame";
                const createdQuestions = await createQuestionsPerGameTrigger(nbaGameId, topStats, quarterTrigger);

                const createdQuestionId = _.get(_.head(createdQuestions), "id");

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });

                expect(question).toHaveLength(1);
                expect(_.head(question).pointWeight).toEqual(100);
                expect(_.head(question).id).toEqual(createdQuestionId);
                expect(_.head(question).name).toEqual("Who will get the highest FT percentage over the entire game?");
            });
            it("lowest_total_stat x third_quarter x free_throw_pct", async () => {
                const quarterTrigger = "second_quarter";
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        automatedModeId: await getNbaAutomatedModeId("lowest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("third_quarter"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                const createdQuestions = await createQuestionsPerGameTrigger(nbaGameId, topStats, quarterTrigger);

                const createdQuestionId = _.get(_.head(createdQuestions), "id");

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
                expect(_.head(question).id).toEqual(createdQuestionId);
                expect(_.head(question).name).toEqual("Who will get the lowest FT percentage in the third quarter?");
            });
        });

        // Removed ScheduledQuestionOfDay functionality
        describe.skip("ScheduledQuestionOfDay - Creates Question and Automated Question and Formats Name Correctly", async () => {
            it("greatest_total_stat x full_game x free_throw_pct", async () => {
                await bootStrapScheduledQuestionOfDay([
                    {
                        pointValue: 100,
                        overwriteName: "Example question?",
                        gameId: nbaGameId,
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);

                const quarterTrigger = "pregame";
                const createdQuestions = await createQuestionsPerGameTrigger(nbaGameId, topStats, quarterTrigger);

                const createdQuestionId = _.get(_.head(createdQuestions), "id");

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
                expect(_.head(question).pointWeight).toEqual(100);
                expect(_.head(question).id).toEqual(createdQuestionId);
                expect(_.head(question).name).toEqual("Example question?");
            });
            it("greatest_total_stat x full_game x free_throw_pct", async () => {
                await bootStrapScheduledQuestionOfDay([
                    {
                        pointValue: 100,
                        gameId: nbaGameId,
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("full_game"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                const quarterTrigger = "pregame";
                const createdQuestions = await createQuestionsPerGameTrigger(nbaGameId, topStats, quarterTrigger);

                const createdQuestionId = _.get(_.head(createdQuestions), "id");

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
                expect(_.head(question).id).toEqual(createdQuestionId);
                expect(_.head(question).name).toEqual("Who will get the highest FT percentage over the entire game?");
            });
        });

        describe("Doesn't create a question because of a bad trigger", async () => {
            it("quarterTrigger received (pregame) x automatedPeriod (second_quarter)", async () => {
                const quarterTrigger = "pregame";
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        description: "Test",
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("second_quarter"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                await createQuestionsPerGameTrigger(nbaGameId, topStats, quarterTrigger);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(0);
            });
            it("quarterTrigger received (fourth_quarter) x automatedPeriod (third_quarter)", async () => {
                const quarterTrigger = "pregame";
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        description: "Test",
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("third_quarter"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                await createQuestionsPerGameTrigger(nbaGameId, topStats, quarterTrigger);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(0);
            });
            it("quarterTrigger received (second_quarter) x automatedPeriod (fourth_quarter)", async () => {
                const quarterTrigger = "second_quarter";
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        description: "Test",
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("fourth_quarter"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                await createQuestionsPerGameTrigger(nbaGameId, topStats, quarterTrigger);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(0);
            });
            it("Creates question - quarterTrigger received (pregame) x automatedPeriod (fourth_quarter)", async () => {
                const quarterTrigger = "third_quarter";
                await bootstrapScheduledQuestions([
                    {
                        pointValue: 100,
                        description: "Test",
                        automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                        automatedPeriodId: await getNbaAutomatedPeriodId("fourth_quarter"),
                        statId: await getNbaAutomatedStatId("free_throw_pct"),
                    },
                ]);
                await createQuestionsPerGameTrigger(nbaGameId, topStats, quarterTrigger);

                const question = await Question.query().where({
                    question_group_id: questionGroupId,
                });
                expect(question).toHaveLength(1);
            });
        });
    });
});
