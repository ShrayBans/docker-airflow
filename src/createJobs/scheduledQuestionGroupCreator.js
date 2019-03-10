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
			const hoursAfterDate = moment(new Date()).add(18, 'hours').toDate()
			const gamesToCreate = await getGamesStartingBefore(hoursAfterDate);

			if (_.size(gamesToCreate) == 0) {
				console.log('No games found to be created');
			}

			// Creates Question Groups
			const createdQuestionGroups = await Bluebird.map(gamesToCreate, async (nbaGame) => {
				return createQuestionGroup(nbaGame);
			});

			// Creates Scheduled Questions Associated
			const createdQuestions = await Bluebird.each(createdQuestionGroups, async(createdQuestionGroup) => {
				const {
					awayTeamQuestionGroup,
					homeTeamQuestionGroup
				} = createdQuestionGroup

				const { channelId: awayChannelId } = awayTeamQuestionGroup;
				const { channelId: homeChannelId } = homeTeamQuestionGroup;

				const createdAwayQuestions = await createQuestionsPerChannel("pregame", awayChannelId);
				const createdHomeQuestions = await createQuestionsPerChannel("pregame", homeChannelId);
			})

			// Extra Scheduled Channel Questions
			// General Channel
			await createQuestionsPerChannel("pregame", 0)

			return resolve(true)
		} catch (err) {
			reject(err);
		}
	})
}

async function getGamesStartingBefore(date = new Date()) {
	const nowUTCString = new Date().toUTCString()
	const UTCString = date.toUTCString()
	return NbaGame.query()
		.eager('[homeTeam.[channel], awayTeam.[channel]]')
		.where("game_datetime", "<", UTCString)
		.where("game_datetime", ">", nowUTCString)
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
		const awayTeamQuestionGroup = await QuestionGroup.query().insertGraphAndFetch({
			channelId: _.get(nbaGameAway, ["channel", "id"]),
			nba_game_id: nbaGameId,
			name: `${_.get(nbaGame, ["awayTeam", "fullName"])} View: ${gameName}`
		}).eager("nbaGame");

		console.log(`${_.get(awayTeam, "name")} question group was created`)
		const homeTeamQuestionGroup = await QuestionGroup.query().insertGraphAndFetch({
			channelId: _.get(nbaGameHome, ["channel", "id"]),
			nba_game_id: nbaGameId,
			name: `${_.get(nbaGame, ["homeTeam", "fullName"])} View: ${gameName}`
		}).eager("nbaGame");;
		console.log(`${_.get(homeTeam, "name")} question group was created`)
	}

	return {
		awayTeamQuestionGroup,
		homeTeamQuestionGroup
	}
}