const {
	instantiateKnex
} = require("../lib/knex.js")

let axios = require('axios');

const Bluebird = require("bluebird")
const _ = require("lodash")
const moment = require('moment-timezone');

const {
	getRandomInterval
} = require("../lib/utils")

const {
	NbaTeam,
	NbaGame,
	NbaBoxScore
} = require("sixthman-objection-models")

run().then(() => {
	process.exit(0)
})
.catch((err) => {
	console.error(err);
	process.exit(1)
});

/**
 * 1. After a game is finished, it is added to a redis queue: { gameId: 1, teamId, gameDate, status: completed}
 * 2. This job runs every 10 minutes, reads from the queue and populates the box score after the game
 * 3. This job takes the teamId and scrapes stats.nba for the last game
 * 4. The data is transformed and
 */

async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)

	return new Promise(async (resolve, reject) => {
		try {
			const thirtyMinuteAfterDate = moment(new Date()).add(30, 'minutes').toDate()
			const gamesToPull = await getGamesStartingBefore(thirtyMinuteAfterDate);
			const filteredGamesToPull = _.chain(gamesToPull).orderBy("gameDatetime").slice(0, 5).value()
			console.log('filteredGamesToPull', filteredGamesToPull);

			const boxScoreCollectionSets = await Bluebird.map(filteredGamesToPull, async (gameObject) => scrapeBothTeamBoxScores(gameObject))
			const flattenedBoxScores = _.flatten(boxScoreCollectionSets);

			// flattedBoxScores: [[{}], [{}]]
			await Bluebird.each(flattenedBoxScores, async (scrapedGameBoxScores) => {
				await Bluebird.each(scrapedGameBoxScores, async (playerGameBoxScore) => {
					return insertPlayerBoxScore(playerGameBoxScore)
				})
				await updateNbaGameScrapedBoxscore(_.head(scrapedGameBoxScores));
			})

			return resolve(true)
		} catch (err) {
			reject(err)
		}
	})
}

async function getGamesStartingBefore(date = new Date()) {
	const UTCString = date.toUTCString()
	const preseasonDate = new Date("2018-10-15").toUTCString()
	return NbaGame.query()
		.whereNull("boxscore_scraped")
		.where("status", "=", "completed")
		.where("game_datetime", "<", UTCString)
		.where("game_datetime", ">", preseasonDate)

}
function snakeToCamel(s){
    return s.toLowerCase().replace(/(\_\w)/g, function(m){return m[1].toUpperCase();});
}

async function scrapeBothTeamBoxScores(gameObject) {
	const pstDate = moment.tz(_.get(gameObject, "gameDatetime"), "America/Los_Angeles").format("MM%2FDD%2FYYYY");
	const gameId = _.get(gameObject, "id");
	const awayTeamId = _.get(gameObject, "awayTeamId");
	const homeTeamId = _.get(gameObject, "homeTeamId");
	const fields = ["PLAYER_ID", "FGM", "FGA", "FG3M", "FG3A", "OREB", "DREB", "REB", "AST", "TOV", "STL", "BLK", "PF", "PTS", "PLUS_MINUS", "NBA_FANTASY_PTS" ];
	const results = [];
	const labelByIndex = {}

	HOME_URL_TO_SCRAPE = `https://stats.nba.com/stats/teamplayerdashboard?DateFrom=${pstDate}&DateTo=${pstDate}&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=${awayTeamId}&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N&Rank=N&Season=2018-19&SeasonSegment=&SeasonType=Regular+Season&TeamId=${homeTeamId}&VsConference=&VsDivision=`
	AWAY_URL_TO_SCRAPE = `https://stats.nba.com/stats/teamplayerdashboard?DateFrom=${pstDate}&DateTo=${pstDate}&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=${homeTeamId}&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N&Rank=N&Season=2018-19&SeasonSegment=&SeasonType=Regular Season&TeamId=${awayTeamId}&VsConference=&VsDivision=`
	const urls = [{ teamType: "home", teamId: homeTeamId, url: HOME_URL_TO_SCRAPE}, { teamType: "away", teamId: awayTeamId, url: AWAY_URL_TO_SCRAPE}];

	const boxScores = await Bluebird.map(urls, async(urlObj) => {
		let boxScoreRaw;
		try {
			console.log('0', 0);
			boxScoreRaw = await axios.get(_.get(urlObj, "url"));
			console.log('1', 1);
			results.push(boxScoreRaw);
		} catch (err) {
			console.error(err.message)
		}
		const rawScrapedBoxScores = _.chain(boxScoreRaw).get(["data", "resultSets"]).filter({ name: "PlayersSeasonTotals" }).head().value()
		_.forEach(_.get(rawScrapedBoxScores, "headers"), (header, i) => {
			_.set(labelByIndex, i, header);
		})
		const transformedBoxScores = _.map(_.get(rawScrapedBoxScores, "rowSet"), (playerRow) => {
			const resultObj = {};

			// Adding stats
			_.forEach(labelByIndex, (playerRowLabel, savedIndex) => {
				if (_.includes(fields, playerRowLabel)) {
					_.set(resultObj, snakeToCamel(playerRowLabel), _.get(playerRow, savedIndex))
				}
			})

			// Additional fields to add
			_.set(resultObj, "gameId", gameId)
			_.set(resultObj, "teamId", _.get(urlObj, "teamId"))

			return resultObj;
		})

		return transformedBoxScores;
	})

	return boxScores;
}

async function updateNbaGameScrapedBoxscore(playerGameBoxScoreObject) {
	const gameId = _.get(playerGameBoxScoreObject, "gameId");
	console.log(`Box Score Loaded from Game Id: ${gameId}`);
	const nbaGame = await NbaGame.query().findById(gameId);
	await nbaGame.$query().patch({
		boxscore_scraped: true,
	});
}

async function insertPlayerBoxScore(scrapedBoxScoreGame) {
	const gameId = _.get(scrapedBoxScoreGame, "gameId")
	const teamId = _.get(scrapedBoxScoreGame, "teamId")
	const playerId = _.get(scrapedBoxScoreGame, "playerId")

	try {
		let nbaBoxScore = await NbaBoxScore.query().findOne({
			game_id: gameId,
			team_id: teamId,
			player_id: playerId,
		});
		if (nbaBoxScore) {
			console.log(`Some events in game: ${gameId}, team: ${teamId}, player: ${playerId} were already loaded!`);
			// console.log(`${_.get(nbaBoxScore, "clock")} ${_.get(nbaBoxScore, "eventMsgType")} already loaded!`);
		} else {
			nbaBoxScore = await NbaBoxScore.query().insert(scrapedBoxScoreGame);
			// console.log(`${_.get(nbaBoxScore, "clock")} ${_.get(nbaBoxScore, "eventMsgType")} loaded!`);
		}

	} catch (err) {
		console.log('err', err);
	}
}