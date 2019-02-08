import * as _ from 'lodash';
import { Channel, createChannelData, createQuestionGroupData, QuestionGroup } from 'sixthman-objection-models';

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
        channel = await Channel.query().insert(createChannelData({ name: "Test Channel" }));
        channelId = _.get(channel, "id");
        questionGroup = await QuestionGroup.query().insert(
            createQuestionGroupData({ channelId: channel.id, name: "Test Question Group" })
        );
        questionGroupId = _.get(questionGroup, "id");
        redisQueue = new RedisQueue("127.0.0.1", 6379);

        await bootstrapNbaAutomatedMode();
        await bootstrapNbaAutomatedPeriod();
        await bootstrapNbaAutomatedStat();

        await bootstrapNbaAutomatedTeam();
        await bootstrapNbaAutomatedGame();
        await bootstrapNbaAutomatedPlayer();
    });
    beforeEach(async () => {
        await fakeGameRunner(redisQueueName, "./resources/warriors-lakers.json");
    });
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

        // @ts-ignore
        const { automatedQuestion } = await createAutomatedQuestion(createAutomatedQuestionPayload);

        await redisQueue.runSpecRSMQConsumer(redisQueueName, evaluateNbaEventMessage, 10);

        _.forEach(automatedQuestion.automatedAnswers, automatedAnswer => {
            console.log("automatedAnswer", automatedAnswer);
            if (_.get(automatedAnswer, "value") === "Andre Iguodala") {
                expect(_.get(automatedAnswer, "statValue")).toEqual(23);
            } else if (_.get(automatedAnswer, "value") === "LeBron James") {
                expect(_.get(automatedAnswer, "statValue")).toEqual(23);
            } else if (_.get(automatedAnswer, "value") === "Stephen Curry") {
                expect(_.get(automatedAnswer, "statValue")).toEqual(23);
            } else if (_.get(automatedAnswer, "value") === "Kevin Durant") {
                expect(_.get(automatedAnswer, "statValue")).toEqual(23);
            }
        });

        expect("lol").toEqual("lol");
    }, 10000);
});
