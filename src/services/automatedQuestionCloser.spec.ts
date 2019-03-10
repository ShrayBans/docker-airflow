import * as _ from "lodash";
import {
    Channel,
    createChannelData,
    createQuestionGroupData,
    NbaGame,
    Question,
    QuestionGroup,
} from "sixthman-objection-models";

import { RedisQueue } from "../lib/RedisQueue";
import {
    bootstrapNbaAutomatedMode,
    bootstrapNbaAutomatedPeriod,
    bootstrapNbaAutomatedStat,
    getNbaAutomatedModeId,
    getNbaAutomatedPeriodId,
    getNbaAutomatedStatId,
} from "../test/fixtures/nbaDimensions";
import { bootstrapNbaGame, bootstrapNbaPlayer, bootstrapNbaTeam } from "../test/fixtures/nbaGames";
import { createAutomatedQuestion } from "./automatedQuestionCreator";
import { closeAutomatedQuestion} from "./automatedQuestionCloser"

describe("Automated Question Closer", async () => {
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

    describe.only("#closeAutomatedQuestion", async () => {
        it("Closing Automated Questions where the period is full_game", async () => {
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

            const { nbaAutomatedQuestion, id: createdQuestionId, isClosed }: Question = await createAutomatedQuestion(
                createAutomatedQuestionPayload
            );
            expect(isClosed).toEqual(false);
            console.log('isClosed', isClosed);

            await closeAutomatedQuestion("pregame")

            const { isClosed: newIsClosed } = await Question.query().findById(createdQuestionId)
            expect(newIsClosed).toEqual(true);


        });
        it("Closing Automated Questions where the period is second_quarter", async () => {
            const createAutomatedQuestionPayload = {
                channelId,
                questionGroupId,
                questionName: "AUTOMATED: Who will have the most free throws in the 1st quarter?",
                pointWeight: 10,
                statId: await getNbaAutomatedStatId("free_throw"),
                automatedModeId: await getNbaAutomatedModeId("greatest_total_stat"),
                automatedPeriodId: await getNbaAutomatedPeriodId("second_quarter"),
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

            const { nbaAutomatedQuestion, id: createdQuestionId, isClosed }: Question = await createAutomatedQuestion(
                createAutomatedQuestionPayload
            );
            expect(isClosed).toEqual(false);

            await closeAutomatedQuestion("first_quarter")

            const { isClosed: newIsClosed } = await Question.query().findById(createdQuestionId)
            expect(newIsClosed).toEqual(true);


        });
        it("Not Closing Automated Questions when the period is not the same as quarter_trigger", async () => {
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

            const { nbaAutomatedQuestion, id: createdQuestionId, isClosed }: Question = await createAutomatedQuestion(
                createAutomatedQuestionPayload
            );
            expect(isClosed).toEqual(false);

            await closeAutomatedQuestion("second_quarter")

            const { isClosed: newIsClosed } = await Question.query().findById(createdQuestionId)
            expect(newIsClosed).toEqual(false);
        });
    });
});
