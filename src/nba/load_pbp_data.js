const {
	instantiateKnex
} = require("../lib/knex.js")

let axios = require('axios');

const _ = require("lodash")
const moment = require('moment-timezone');

const {
	NbaTeam,
	NbaGame,
	NbaPlayByPlay
} = require("sixthman-objection-models")

const eventMsgMap = {
	1: "Shot Made",
	2: "Shot Missed",
	3: "Free Throw Make/Miss",
	4: "Rebound",
	5: "Turnover",
	6: "Shooting Foul",
	7: "Kicked Ball",
	8: "Substitution",
	9: "Timeout",
	10: "Jump Ball",
	11: "Ejection",
	12: "Start Period",
	13: "End Period",
	18: "Instant Replay",
	20: "Stoppage"
}

run().then(() => {
	process.exit(0)
});

async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)

	return new Promise((resolve) => {
		console.log('Starting NBA Play by Play scraper!');
		const interval = setInterval(async () => {

				console.log('1', 1);
				// const thirtyMinuteAfterDate = moment(today).add(30, 'minutes').toDate()
				const thirtyMinuteAfterDate = moment(new Date()).add(1, 'day').toDate()
				const gamesToPull = await getGamesStartingBefore(thirtyMinuteAfterDate);

				if (!_.size(gamesToPull)) {
					clearInterval(interval)
					return resolve(true)
				}

				console.log(`${_.size(gamesToPull)} games left to find play by plays for!`);

				// If quarter has completed, then send a message to Redis Pub Sub and change status to next quarter (not_started, 1, 2, 3, 4, 5, completed)
				const playByPlayCollectionSets = await _.map(gamesToPull, async (game) => await scrapePlayByPlayCollectionSets(game))
				console.log('playByPlayCollectionSets', playByPlayCollectionSets);

				_.forEach(playByPlayCollectionSets, async (playByPlayCollection) => {
					await insertPlayByPlay(playByPlayCollection)
				})
			},
			1000)
	})
}

async function getGamesStartingBefore(date = new Date()) {
	const UTCString = date.toUTCString()
	return NbaGame.query()
		.where("status", "!=", "completed")
		.where("game_datetime", "<", UTCString)
}

async function scrapePlayByPlayCollectionSets(game) {
	const pstDate = moment.tz(_.get(game, "gameDatetime"), "America/Los_Angeles").format("YYYYMMDD");
	const gameId = _.get(game, "id");
	const gameStatus = _.get(game, "status");

	let quarterToPull;
	if (gameStatus === "not_started") {
		quarterToPull = 1;
		const nbaGame = await NbaGame.query().findById(gameId);
		await nbaGame.$query().patch({
			status: "1"
		});
	} else {
		quarterToPull = parseInt(gameStatus);
	}

	URL_TO_SCRAPE = `https://data.nba.net/prod/v1/${pstDate}/00${gameId}_pbp_${quarterToPull}.json`
	console.log('URL_TO_SCRAPE', URL_TO_SCRAPE);

	let playByPlayRaw;
	try {
		playByPlayRaw = await axios.get(URL_TO_SCRAPE);
	} catch (err) {
		console.error(err.message)
	}

	return _.get(playByPlayRaw, ["data", "plays"])
}

async function incrementGameQuarterState({
	eventMsgType,
	quarterToPull,
	homeTeamScore,
	awayTeamScore,
	gameId
}) {
	// Represents the End of the Game but going into OT
	if (eventMsgType == 13 && quarterToPull >= 4 && homeTeamScore == awayTeamScore) {
		const nbaGame = await NbaGame.query().findById(gameId);
		await nbaGame.$query().patch({
			status: quarterToPull + 1,
		});
		// Represents the End of the Game
	} else if (eventMsgType == 13 && quarterToPull >= 4) {
		const nbaGame = await NbaGame.query().findById(gameId);
		await nbaGame.$query().patch({
			status: "completed",
		});
		// Represents the End of the Period
	} else if (eventMsgType == 13) {
		const nbaGame = await NbaGame.query().findById(gameId);
		await nbaGame.$query().patch({
			status: quarterToPull + 1,
		});
	}
}

async function insertPlayByPlay(playByPlayCollection) {
	await _.forEach(playByPlayCollection, async (playByPlay) => {
		const clock = _.get(playByPlay, "clock")
		const eventMsgType = _.get(playByPlay, "eventMsgType")
		const eventMsgDescription = _.get(eventMsgMap, eventMsgType)
		if (!eventMsgDescription) {
			console.log("EVENT NOT RECONGIZED")
			console.log('playByPlay', playByPlay);
		}
		const description = _.get(playByPlay, ["formatted", "description"]) || _.get(playByPlay, "description")
		const teamId = _.get(playByPlay, "teamId")
		const homeTeamScore = _.get(playByPlay, "hTeamScore")
		const awayTeamScore = _.get(playByPlay, "vTeamScore")
		const playerId = _.get(playByPlay, "personId")

		const playByPlayInfo = {
			gameId,
			gameDate: pstDate,
			quarter: quarterToPull,
			clock,
			eventMsgType,
			eventMsgDescription,
			description,
			teamId: _.size(teamId) ? teamId : undefined,
			homeTeamScore,
			awayTeamScore,
			playerId: _.size(playerId) ? playerId : undefined,
		};

		try {
			let nbaPlayByPlay = await NbaPlayByPlay.query().findOne({
				game_id: gameId,
				quarter: quarterToPull,
				clock,
				event_msg_type: eventMsgType
			});
			if (nbaPlayByPlay) {
				console.log(`${_.get(nbaPlayByPlay, "clock")} ${_.get(nbaPlayByPlay, "eventMsgType")} already loaded!`);
			} else {
				nbaPlayByPlay = await NbaPlayByPlay.query().insert(playByPlayInfo);
				console.log(`${_.get(nbaPlayByPlay, "clock")} ${_.get(nbaPlayByPlay, "eventMsgType")} loaded!`);
			}

			await incrementGameQuarterState({
				eventMsgType,
				quarterToPull,
				homeTeamScore,
				awayTeamScore,
				gameId
			});
		} catch (err) {

			try {
				// For timeouts and a couple other events, the player_id is actually the team_id, so check it and insert it accordingly
				const nbaTeam = await NbaTeam.query().findOne({
					id: playerId
				})
				if (nbaTeam) {
					const playByPlayInfo = {
						gameId,
						gameDate: pstDate,
						quarter: quarterToPull,
						clock,
						eventMsgType,
						eventMsgDescription,
						description,
						teamId: _.size(playerId) ? playerId : undefined,
						homeTeamScore,
						awayTeamScore,
						playerId: undefined,
					};
					nbaPlayByPlay = await NbaPlayByPlay.query().insert(playByPlayInfo);
				}
			} catch (err) {
				console.log('err', err);
				console.log('playByPlayInfo', playByPlayInfo);
			}
		}
	})
}