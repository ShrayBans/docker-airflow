import * as _ from "lodash";
import { transaction } from "objection";
import {
    Base,
    NbaAutomatedMode,
    NbaAutomatedPeriod,
    NbaAutomatedQuestion,
    NbaStat,
    Question,
} from "sixthman-objection-models";

/**
 * Creates an NbaAutomatedQuestion as well as a Question.
 * @param createAutomatedQuestionPayload
 */
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
        : await generateQuestionName(statId, automatedModeId, automatedPeriodId);

    const filteredAnswersPayload = _.map(answersPayload, answer => {
        answer.status = _.get(answer, "status", "incorrect");
        return _.pick(answer, ["value", "status"]);
    });
    const test = {
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

    return transaction(Base.knex(), async trx => {
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
export async function generateQuestionName(statId, automatedModeId, automatedPeriodId) {
    const stat = await NbaStat.query().findById(statId);
    const mode = await NbaAutomatedMode.query().findById(automatedModeId);
    const period = await NbaAutomatedPeriod.query().findById(automatedPeriodId);

    let transformedStat = _.get(stat, "sentenceFragment");
    let transformedMode = _.get(mode, "sentenceFragment");
    let transformedPeriod = _.get(period, "sentenceFragment");

    // Transform Mode
    if (_.endsWith(_.get(stat, "statName"), "pct")) {
        if (_.get(mode, "modeName") === "greatest_total_stat") {
            transformedMode = "get the highest";
        } else if (_.get(mode, "modeName") === "lowest_total_stat") {
            transformedMode = "get the lowest";
        }
    }

    // Transform Period

    // Transform Stat
    if (
        !_.endsWith(_.get(stat, "statName"), "pct") && // `free_throw_pct` Doesn't end in pct
        !(_.get(mode, "modeName") === "first_stat" || _.get(mode, "modeName") === "last_stat") // mode is not `first_stat`
    ) {
        transformedStat = `${transformedStat}s`;
    }
    if (!transformedStat || !transformedPeriod) {
        console.log("id", statId, automatedModeId, automatedPeriodId);
        const output = `Who will ${transformedMode} ${transformedStat} ${transformedPeriod}?`;
        console.log("output", output);
    }
    return `Who will ${transformedMode} ${transformedStat} ${transformedPeriod}?`;
}
