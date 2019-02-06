const _ = require("lodash");
const Bluebird = require("bluebird")
const {
    instantiateKnex
} = require("../lib/knex.js")

const {
    Question,
    NbaAutomatedQuestion,
    Base
} = require("sixthman-objection-models")

const {
    transaction
} = require("objection");

async function run() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION)

    const lol = await createAutomatedQuestion();
    console.log('lol', lol);

}

run().then(() => {
        process.exit(0)
    })
    .catch((err) => {
        console.error(err);
        process.exit(1)
    });



async function createAutomatedQuestion(questionGroupId = 1, statId = 1, automatedModeId = 3, automatedPeriodId = 3, gameId = 21800500) {
    console.log('questionGroupId', questionGroupId); // First question group that was created
    console.log('statId', statId); // Stat Id = 1, points
    console.log('statId', statId); // Stat Id = 1, points

    const answersPayload = [{
            value: "Automated: LeBron James",
            status: "incorrect",
            statId,
            playerId: 2544,
            teamId: 1610612747,
        },
        {
            value: "Automated: Stephen Curry",
            status: "incorrect",
            statId,
            playerId: 201939,
            teamId: 1610612744,
        },
        {
            value: "Automated: Kevin Durant",
            status: "incorrect",
            statId,
            playerId: 201142,
            teamId: 1610612744,
        }
    ]

    const filteredAnswersPayload = _.map(answersPayload, (answer) => _.pick(answer, ["value", "status"]))
    console.log('filteredAnswersPayload', filteredAnswersPayload);

    return transaction(Base.knex(), async (trx) => {

        const questionPayload = {
            questionGroupId,
            name: "AUTOMATED: Who will have the most points in the 3rd quarter?",
            pointWeight: 10,
            questionType: "multi_choice",
            isClosed: false,
            status: "unanswered",
            answers: filteredAnswersPayload
        };

        const createdQuestion = await Question.query(trx).insertGraphAndFetch(questionPayload).eager("[answers]");
        // console.log('createdQuestion', createdQuestion);

        const createdAnswers = _.get(createdQuestion, "answers");

        const mergedAnswers = []
        _.forEach(answersPayload, (answerPayload) => {
            return _.forEach(createdAnswers, (createdAnswer) => {
                if (_.get(createdAnswer, "value") === _.get(answerPayload, "value")) {
                    const mergedAnswer = _.assign({}, answerPayload, {
                        answerId: _.get(createdAnswer, "id")
                    })
                    mergedAnswers.push(mergedAnswer);
                }
            })
        });

        const automatedQuestionPayload = {
            questionId: _.get(createdQuestion, "id"),
            statId,
            automatedModeId,
            automatedPeriodId,
            description: "AUTOMATED: Who will have the most points in the 3rd quarter?",
            status: "unanswered",
            gameId,
            // value, stat_value, status, automated_question_id, answer_id, stat_id, player_id, team_id
            automatedAnswers: mergedAnswers
        }

        await NbaAutomatedQuestion.query(trx).insertGraph(automatedQuestionPayload);
    });
}

// Create question

// Create auto_question (question)
// Create ansewr (question)

// Create auto_answer (auto_question, answer)