const {
	instantiateKnex
} = require("../lib/knex.js")

const Bluebird = require("bluebird")
const _ = require("lodash")
const moment = require('moment-timezone');

const {
	NbaGame,
	QuestionGroup
} = require("sixthman-objection-models")

run().then(() => {
	process.exit(0)
}).catch(() => {
	process.exit(1)
});

/**
 * This job should run every hour.
 */
async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)

	return new Promise(async (resolve) => {
		const threeHoursAfterDate = moment(new Date()).add(3, 'hours').toDate()
		const gamesToCreate = await getGamesStartingBefore(threeHoursAfterDate);

		if (_.size(gamesToCreate) == 0) {
			console.log('No games found to be created');
		}

		await Bluebird.each(gamesToCreate, async (nbaGame) => {
			await createQuestionGroup(nbaGame)
		});

		return resolve(true)
	})
}

async function getGamesStartingBefore(date = new Date()) {
	const UTCString = date.toUTCString()
	return NbaGame.query()
		.eager('[homeTeam.[channel], awayTeam.[channel]]')
		.where("status", "!=", "completed")
		.where("game_datetime", "<", UTCString)
}

async function createQuestionGroup(nbaGame) {
	const nbaGameId = _.get(nbaGame, "id");
	const nbaGameHome = _.get(nbaGame, "homeTeam");
	const nbaGameAway = _.get(nbaGame, "awayTeam");
	const questionGroups = await QuestionGroup.query().where({
		nba_game_id: nbaGameId
	})
	const gameName = _.get(nbaGame, ["awayTeam", "fullName"]) + " @ " + _.get(nbaGame, ["homeTeam", "fullName"]);

	if (_.size(questionGroups) === 0) {
		const awayTeam = await QuestionGroup.query().insertGraphAndFetch({
			channelId: _.get(nbaGameAway, ["channel", "id"]),
			nba_game_id: nbaGameId,
			name: `${_.get(nbaGame, ["awayTeam", "fullName"])} View: ${gameName}`
		});
		console.log(`${_.get(awayTeam, "name")} question group was created`)
		const homeTeam = await QuestionGroup.query().insertGraphAndFetch({
			channelId: _.get(nbaGameHome, ["channel", "id"]),
			nba_game_id: nbaGameId,
			name: `${_.get(nbaGame, ["homeTeam", "fullName"])} View: ${gameName}`
		});
		console.log(`${_.get(homeTeam, "name")} question group was created`)

	}
}