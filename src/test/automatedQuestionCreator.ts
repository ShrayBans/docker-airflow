import * as _ from "lodash";
import { Model, transaction } from "objection";
import { NbaAutomatedQuestion, Question } from "sixthman-objection-models";

export async function createAutomatedQuestion(createAutomatedQuestionPayload) {
    const {
        channelId = 1,
        questionGroupId = 1,
        questionName,
        pointWeight = 10,
        statId = 1,
        automatedModeId = 3,
        automatedPeriodId = 7,
        gameId = 21800500,
        questionType = "multi_choice",
        answersPayload = [
            {
                value: "Automated: LeBron James",
                playerId: 2544,
                teamId: 1610612747,
            },
            {
                value: "Automated: Stephen Curry",
                playerId: 201939,
                teamId: 1610612744,
            },
            {
                value: "Automated: Kevin Durant",
                playerId: 201142,
                teamId: 1610612744,
            },
            {
                value: "Automated: Andre Iguodala",
                playerId: 2738,
                teamId: 1610612744,
            },
        ],
    } = createAutomatedQuestionPayload;

    const usedQuestionName = questionName
        ? questionName
        : generateQuestionName(statId, automatedModeId, automatedPeriodId);

    const filteredAnswersPayload = _.map(answersPayload, answer => {
        answer.status = _.get(answer, "status", "incorrect");
        return _.pick(answer, ["value", "status"]);
    });

    return transaction(Model.knex(), async trx => {
        const questionPayload = {
            channelId,
            questionGroupId,
            name: usedQuestionName,
            pointWeight,
            questionType,
            isClosed: false,
            status: "unanswered",
            closingType: "stat_automated",
            answers: filteredAnswersPayload,
        };

        const createdQuestion = await Question.query(trx)
            .insertGraphAndFetch(questionPayload)
            .eager("[answers]");

        const createdAnswers = _.get(createdQuestion, "answers");

        const mergedAnswers = [];
        _.forEach(answersPayload, answerPayload => {
            return _.forEach(createdAnswers, createdAnswer => {
                if (_.get(createdAnswer, "value") === _.get(answerPayload, "value")) {
                    const mergedAnswer = _.assign({}, answerPayload, {
                        answerId: _.get(createdAnswer, "id"),
                        statId,
                        status: _.get(answerPayload, "status", "incorrect"),
                    });
                    mergedAnswers.push(mergedAnswer);
                }
            });
        });

        const automatedQuestionPayload = {
            questionId: _.get(createdQuestion, "id"),
            statId,
            automatedModeId,
            automatedPeriodId,
            description: usedQuestionName,
            gameId,
            // value, stat_value, status, automated_question_id, answer_id, stat_id, player_id, team_id
            automatedAnswers: mergedAnswers,
        };

        const createdAutomatedQuestion = await NbaAutomatedQuestion.query(trx).insertGraphAndFetch(
            automatedQuestionPayload
        );
        _.set(createdQuestion, "nbaAutomatedQuestion", createdAutomatedQuestion);

        return createdQuestion;
    });
}

/**
 * Generates a question name based on the params inputted (i.e. points, mode, period)
 *  -> Who will get {MODE} {STAT} in the {PERIOD}
 * @param statId
 * @param automatedModeId
 * @param automatedPeriodId
 */
function generateQuestionName(statId, automatedModeId, automatedPeriodId) {
    return "test";
}
