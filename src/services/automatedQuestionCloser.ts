import { NbaAutomatedAnswer, NbaAutomatedQuestion, Question } from 'sixthman-objection-models';
import _ = require("lodash");
import { getUnansweredAutomatedQuestions } from './answerAutomatedQuestion';
import * as Bluebird from 'bluebird';

const automatedQuestionCache = {};


/**
 * Closes automated questions when a quarter is over
 * (i.e) When quarter 1 is starting, then questions triggered to be created "pregame" are closed
 * @param unansweredAutomatedQuestion
 */
export async function closeAutomatedQuestion(quarterTrigger) {
    // Optimization added by adding a local cache, which allows us to add where clause to not pull IDs in the cache
    const cachedQuestionIds = _.keys(automatedQuestionCache);
    const unansweredQuestions = await getUnansweredAutomatedQuestions(cachedQuestionIds);
    _.forEach(unansweredQuestions, unansweredQuestion => {
        _.set(automatedQuestionCache, _.get(unansweredQuestion, "id"), unansweredQuestion);
    });
    const allQuestionIds = _.keys(automatedQuestionCache);
    const allQuestionValues = _.values(automatedQuestionCache);

    await Bluebird.each(allQuestionValues, async (unansweredAutomatedQuestion: NbaAutomatedQuestion) => {
        const automatedPeriodTrigger = _.get(unansweredAutomatedQuestion, ["automatedPeriod", "quarterTrigger"])

        if (automatedPeriodTrigger === quarterTrigger) {
            const questionId: number = _.get(unansweredAutomatedQuestion, ["question", "id"]);
            const question = await Question.query().patchAndFetchById(questionId, {
                isClosed: true,
            });
        }
    });
}