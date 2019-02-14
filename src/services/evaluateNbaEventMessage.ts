import * as _ from "lodash";
import { RedisClient } from "redis";
import { NbaGame } from "sixthman-objection-models";

import { answerAutomatedQuestion } from "../services/answerAutomatedQuestion";
import { createScheduledQuestionsPerGame } from "../services/createScheduledQuestionsPerGame";

/**
 * Callback handler for event consumer which has various functions
 * 1. Identifies and filters for messages that we care for (i.e. Start and End of Quarters)
 * 2. Routes each message to the appropriate downstream functionality
 *  - answerAutomatedQuestion which is used for automated question answering
 *  - createScheduledQuestionsPerGame which is used to created questions which were previously scheduled
 * @param redisClient
 */
export function evaluateNbaEventMessage(redisClient: RedisClient) {
    return async function(receivedPlayByPlayEvent) {
        const gameId = _.get(receivedPlayByPlayEvent, "game_id");
        const game = await NbaGame.query().findById(gameId);

        const eventMsgType = _.get(receivedPlayByPlayEvent, "event_msg_type");
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
            await createScheduledQuestionsPerGame(redisClient, game, quarterTrigger);
        }
    };
}

function parseQuarterTrigger(quarter) {
    let quarterTrigger = "";
    if (quarter === 1) {
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
