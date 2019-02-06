const {
	instantiateKnex
} = require("../lib/knex.js")
const RedisQueue = require("../lib/redis-queue")

const Bluebird = require("bluebird")
const _ = require("lodash")
const moment = require('moment-timezone');

const automatedQuestionCache = {}

const {
	NbaAutomatedQuestion,
	QuestionGroup,
	NbaAutomatedAnswer,
	NbaPlayByPlay,
	Base
} = require("sixthman-objection-models")

const {
	transaction
} = require("objection");

run().then(() => {
	process.exit(0)
}).catch((err) => {
	console.error(err);
	process.exit(1)
});

/**
 * This job should run every hour.
 */
async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)

	return new Promise(async (resolve, reject) => {
		try {
			// Keep going until games are over

			const queueName = "myqueue"
			const redisQueue = new RedisQueue("127.0.0.1", 6379)

			await redisQueue.runRSMQConsumer(queueName, callbackFunc);

			return resolve(true)
		} catch (err) {
			reject(err);
		}
	})
}

async function getUnansweredAutomatedQuestions(excludedQuestionIds) {
	return NbaAutomatedQuestion.query()
		.eager(`[
					automatedMode,
					automatedPeriod,
					question,
					stat,
					automatedAnswers.[answer]
				]
			  `)
		.where("status", "=", "unanswered")
		.whereNotIn("id", excludedQuestionIds || [])
}

async function callbackFunc(result) {
	const receivedEvent = _.get(result, "message");

	// Optimization added by adding a local cache, which allows us to add where clause to not pull IDs in the cache
	const cachedQuestionIds = _.keys(automatedQuestionCache)
	const unansweredQuestions = await getUnansweredAutomatedQuestions(cachedQuestionIds);
	console.log('unansweredQuestions', unansweredQuestions);

	_.forEach(unansweredQuestions, (unansweredQuestion) => {
		_.set(automatedQuestionCache, _.get(unansweredQuestion, "id"), unansweredQuestion);
	})

	const allQuestionIds = _.keys(automatedQuestionCache);
	const allQuestionValues = _.values(automatedQuestionCache);

	await Bluebird.each(allQuestionValues, async (unansweredQuestion) => {
		const periodName = _.get(unansweredQuestion, ["automatedPeriod", "periodName"]);
		let correctAnswer;

		// If end of period, Split based on quarter and then question period
		if (_.get(receivedEvent, "event_msg_type") === 13) {
			const eventQuarter = _.get(receivedEvent, "quarter")

			if (eventQuarter === 4) {
				if (periodName === "full_game") {
					correctAnswer = await calculateCorrectAnswer(unansweredQuestion);
				} else if (periodName === "second_half") {
					correctAnswer = await calculateCorrectAnswer(unansweredQuestion);
				} else if (periodName === "fourth_quarter") {
					correctAnswer = await calculateCorrectAnswer(unansweredQuestion);
				}
			} else if (eventQuarter === 2) {
				if (periodName === "second_quarter") {
					correctAnswer = await calculateCorrectAnswer(unansweredQuestion);
				} else if (periodName === "first_half") {
					correctAnswer = await calculateCorrectAnswer(unansweredQuestion);
				}
			} else if (eventQuarter === 1) {
				if (periodName === "first_quarter") {
					correctAnswer = await calculateCorrectAnswer(unansweredQuestion);
				}
			} else if (eventQuarter === 3) {
				if (periodName === "third_quarter") {
					correctAnswer = await calculateCorrectAnswer(unansweredQuestion)
				}
			}
		}
		console.log('!!correctAnswer', !!correctAnswer);
		// console.log('correctAnswer', correctAnswer);
		if (correctAnswer) {
			await updateQuestionAndAnswerValues(unansweredQuestion, correctAnswer);
		}
		// Update the question (close and answer), automated_question, automated_answer, answer with the correct answer,
	});


	// Check all questions to see if there are any first_score questions
	// - If there is, will have to handle in a different way with redis potentially

	return true;
}

async function updateQuestionAndAnswerValues(unansweredQuestion, correctAnswer) {
	console.log('unansweredQuestion', unansweredQuestion);
	return transaction(Base.knex(), async (trx) => {

		const question = _.get(unansweredQuestion, "question");
		await question.$query(trx).patch({
			status: "answered"
		});

		await unansweredQuestion.$query(trx).patch({
			status: "answered"
		});

		const answer = _.get(correctAnswer, "answer");
		await answer.$query(trx).patch({
			status: "correct"
		});

		const correctAnswerId = _.get(correctAnswer, "id");
		await NbaAutomatedAnswer.query(trx).findById(correctAnswerId).patch({
			status: "correct"
		});
		console.log('correctAnswer', correctAnswer);
	});
}

async function calculateCorrectAnswer(unansweredQuestion) {
	const periodName = _.get(unansweredQuestion, ["automatedPeriod", "periodName"]);
	const modeName = _.get(unansweredQuestion, ["automatedMode", "modeName"]);
	const statName = _.get(unansweredQuestion, ["stat", "statName"]);

	const automatedAnswers = _.get(unansweredQuestion, "automatedAnswers");
	const gameId = _.get(unansweredQuestion, "gameId")

	const enrichedAutomatedAnswers = await Bluebird.map(automatedAnswers, async (automatedAnswer) => {
		const playerId = _.get(automatedAnswer, "playerId")
		const teamId = _.get(automatedAnswer, "teamId")
		const pbpQuery = NbaPlayByPlay.query();

		pbpQuery.where("game_id", gameId)

		if (playerId) {
			pbpQuery.where("player_id", playerId)
		} else if (teamId) {
			pbpQuery.where("team_id", teamId)
		}

		applyStatFilter(pbpQuery, statName)
		applyPeriodFilter(pbpQuery, periodName)

		// For each player, check pbp and aggregate all points
		const playsPbps = await pbpQuery;

		const enrichedPlayByPlays = applyStatEnrichment(playsPbps, statName);
		const calc = applyModeCalculation(enrichedPlayByPlays, modeName);

		return _.assign({}, automatedAnswer, calc);
	});

	const correctAnswer = selectCorrectAutomatedAnswer(enrichedAutomatedAnswers, modeName);

	return correctAnswer;
}

function selectCorrectAutomatedAnswer(enrichedAutomatedAnswers, modeName) {
	let correctAutomatedAnswer = {};
	_.forEach(enrichedAutomatedAnswers, (automatedAnswer) => {
		// TODO: Decide how to handle cases where stats equal each other

		if (modeName === "greatest_total_stat") {
			if (_.get(correctAutomatedAnswer, "statValue", 0) < _.get(automatedAnswer, "statValue", 0)) {
				correctAutomatedAnswer = automatedAnswer;
			}
		} else if (modeName === "lowest_total_stat") {
			if (_.get(correctAutomatedAnswer, "statValue", 0) > _.get(automatedAnswer, "statValue", 0)) {
				correctAutomatedAnswer = automatedAnswer;
			}
		}
		// TODO: Discuss this scenario since this will often provide multiple correct answers
		else if (modeName === "at_least") {
			if (_.get(correctAutomatedAnswer, "statValue", 0) < _.get(automatedAnswer, "statValue", 0)) {
				correctAutomatedAnswer = automatedAnswer;
			}
		}
	})

	return correctAutomatedAnswer;
}

function applyModeCalculation(playsPbps, modeName) {
	if (modeName === "greatest_total_stat" || modeName === "lowest_total_stat" || modeName === "at_least") {
		const total = _.sumBy(playsPbps, "statValue");

		return {
			statValue: total,
		}
	}
}

function applyStatEnrichment(playsPbps, statName) {
	if (statName === "points") {
		return _.map(playsPbps, (playsPbp) => {
			if (_.includes(_.get(playsPbp, "description"), "Free Throw")) {
				return _.assign({}, playsPbp, {
					statValue: 1
				})
			} else if (_.includes(_.get(playsPbp, "description"), "3pt Shot")) {
				return _.assign({}, playsPbp, {
					statValue: 3
				})
			} else {
				return _.assign({}, playsPbp, {
					statValue: 2
				})
			}
		});
	}
}

function applyStatFilter(pbpQuery, statName) {
	if (statName === "points") {
		pbpQuery.whereIn("event_msg_type", [1, 3]).whereLike("description", "%PTS)")
	}
}

function applyPeriodFilter(pbpQuery, periodName) {
	if (periodName === "full_game") {
		pbpQuery.whereIn("quarter", [1, 2, 3, 4])
	} else if (periodName === "second_half") {
		pbpQuery.whereIn("quarter", [3, 4])
	} else if (periodName === "fourth_quarter") {
		pbpQuery.whereIn("quarter", [4])
	} else if (periodName === "first_half") {
		pbpQuery.whereIn("quarter", [1, 2])
	} else if (periodName === "second_quarter") {
		pbpQuery.whereIn("quarter", [2])
	} else if (periodName === "first_quarter") {
		pbpQuery.whereIn("quarter", [1])
	} else if (periodName === "third_quarter") {
		pbpQuery.whereIn("quarter", [3])
	}
}