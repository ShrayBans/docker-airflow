import * as _ from "lodash";
import {
    Channel,
    createChannelData,
    createQuestionGroupData,
    NbaGame,
    NbaStat,
    QuestionGroup,
} from "sixthman-objection-models";

import { createRedisClient } from "../lib/redisClient";
import {
    bootstrapNbaAutomatedMode,
    bootstrapNbaAutomatedPeriod,
    bootstrapNbaAutomatedStat,
} from "../test/fixtures/nbaDimensions";
import { bootstrapNbaGame, bootstrapNbaPlayer, bootstrapNbaTeam } from "../test/fixtures/nbaGames";
import { pullTop4PlayersPerStat } from "./pullPredictionStats";

describe("Question Group Services", async () => {
    const redisQueueName = "test-queue";
    let channel;
    let questionGroup;

    beforeAll(async () => {
        await bootstrapNbaTeam();
        await bootstrapNbaGame();
        await bootstrapNbaPlayer();
    });
    beforeEach(async () => {
        await bootstrapNbaAutomatedMode();
        await bootstrapNbaAutomatedPeriod();
        await bootstrapNbaAutomatedStat();
        channel = await Channel.query().insert(createChannelData({ name: "Test Channel" }));
        questionGroup = await QuestionGroup.query().insert({
            ...createQuestionGroupData({ channelId: channel.id, name: "Test Question Group" }),
            nbaGameId: 21800500,
        });
    });

    describe.skip("#pullTop4PlayersPerStat", async () => {
        it("Pulls top prediction stats for game 21800500", async () => {
            const redisClient = createRedisClient("socket-server.yoy1ao.0001.usw1.cache.amazonaws.com", 6379);

            const game = await NbaGame.query().findById(21800500);
            const nbaStats = await NbaStat.query();
            const nbaStatAbbrevs = _.map(nbaStats, "abbrev");
            const stats = await pullTop4PlayersPerStat(redisClient, game, nbaStatAbbrevs);

            console.log("stats", JSON.stringify(stats));
        });
    });
});
