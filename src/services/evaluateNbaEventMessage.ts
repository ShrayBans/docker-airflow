import * as _ from "lodash";
import { RedisClient } from "redis";
import { NbaGame, NbaPlayByPlay } from "sixthman-objection-models";

import { answerAutomatedQuestion } from "../services/answerAutomatedQuestion";
import { createScheduledQuestionsPerGame } from "../services/createScheduledQuestions";
import { closeAutomatedQuestion } from "./automatedQuestionCloser";

/**
 * Callback handler for event consumer which has various functions
 * 1. Identifies and filters for messages that we care for (i.e. Start and End of Quarters)
 * 2. Routes each message to the appropriate downstream functionality
 *  - answerAutomatedQuestion which is used for automated question answering
 *  - createScheduledQuestionsPerGame which is used to created questions which were previously scheduled
 * @param redisClient
 */
export function evaluateNbaEventMessage(redisClient: RedisClient) {
    return async function(receivedPlayByPlayEvent: NbaPlayByPlay) {
        const gameId = _.get(receivedPlayByPlayEvent, "gameId");
        const game = await NbaGame.query().findById(gameId);
        console.log(`received nba play by play event from: id ${receivedPlayByPlayEvent.id} and gameId ${gameId}`);

        // NOTE: Currently filtering out every other event other than 12 and 13 in `sendToRedisQueue`
        const eventMsgType = _.get(receivedPlayByPlayEvent, "eventMsgType");
        const endOfQuarterEvent = eventMsgType === 13;
        const startOfQuarterEvent = eventMsgType === 12;

        // Automated Question Answering
        if (endOfQuarterEvent) {
            await answerAutomatedQuestion(receivedPlayByPlayEvent);
        }
        // Automated Question Creation
        if (startOfQuarterEvent) {
            const quarter = _.get(receivedPlayByPlayEvent, "quarter");
            const quarterTrigger = parseQuarterTrigger(quarter);
            await createScheduledQuestionsPerGame(redisClient, quarterTrigger, game);
        }
        // Automated Question Closing - when quarter 2 starts, questions triggered to be created in quarter 1 are to be closed
        if (startOfQuarterEvent) {
            const quarter = _.get(receivedPlayByPlayEvent, "quarter");
            // Subtracts 1 from quarter in order to signify th
            const quarterTrigger = parseQuarterTrigger(quarter - 1);
            await closeAutomatedQuestion(quarterTrigger);
        }
    };
}

function parseQuarterTrigger(quarter) {
    let quarterTrigger = "";
    if (quarter === 0) {
        quarterTrigger = "pregame";
    } else if (quarter === 1) {
        quarterTrigger = "first_quarter";
    } else if (quarter === 2) {
        quarterTrigger = "second_quarter";
    } else if (quarter === 3) {
        quarterTrigger = "third_quarter";
    } else if (quarter === 4) {
        quarterTrigger = "fourth_quarter";
    }
    return quarterTrigger;
}
