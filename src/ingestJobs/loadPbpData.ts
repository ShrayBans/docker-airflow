import { RedisQueue } from "../lib/RedisQueue";
import { NbaPlayByPlay, NbaTeam, NbaGame, } from "sixthman-objection-models";

const {
	instantiateKnex
} = require("../lib/knex.js")

let axios = require('axios');

const Bluebird = require("bluebird")
const _ = require("lodash")
const moment = require('moment-timezone');

import { getRandomInterval } from "../lib/utils"

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
	})
	.catch((err) => {
		console.error(err);
		process.exit(1)
	});

const teamCache = {}

async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)
	const redisQueue: RedisQueue = new RedisQueue(process.env.REDIS_HOST, process.env.REDIS_PORT);
    const queueName = process.env.PLAY_BY_PLAY_QUEUE || "prod-pbp";
	await redisQueue.createQueue(queueName);
	const nbaTeams = await NbaTeam.query();

	_.forEach(nbaTeams, (nbaTeam: NbaTeam) => {
		_.set(teamCache, _.get(nbaTeam, "id"), nbaTeam);
	});

	return new Promise((resolve, reject) => {
		try {
			const randomInterval = 3000;
			let lock = false;
			console.log(`Starting NBA Play by Play scraper with random interval of ${randomInterval / 1000 } seconds`);

			const interval = setInterval(async () => {
				if (lock === false) {
					lock = true;
					const thirtyMinuteAfterDate = moment(new Date()).add(30, 'minutes').toDate()
					const gamesToPull = await getGamesStartingBefore(thirtyMinuteAfterDate);
					const filteredGamesToPull = _.chain(gamesToPull).orderBy("gameDatetime").slice(0, 10).value()

					if (!_.size(filteredGamesToPull)) {
						clearInterval(interval)
						return resolve(true)
					}

					console.log(`${_.size(filteredGamesToPull)} games left to find play by plays for!`);

					// If quarter has completed, then send a message to Redis Pub Sub and change status to next quarter (not_started, 1, 2, 3, 4, 5, completed)
					const beforeScrape = Date.now();
					const playByPlayCollectionSets = await Bluebird.map(filteredGamesToPull, async (gameObject) => scrapePlayByPlayCollection(gameObject))
					const afterScrape = Date.now();
					console.log('Time to scrape', afterScrape-beforeScrape);

					// Checking if playByPlay has been inserted, and if not, then inserting them into the DB
					await Bluebird.each(playByPlayCollectionSets, async (scrapedGamePlayByPlays) => {
						const beforePbp = Date.now();
						const pbpToBeInserted: Partial<NbaPlayByPlay>[] = await getPlayByPlaysToBeInserted(scrapedGamePlayByPlays, redisQueue, queueName);
						const afterPbp = Date.now();
						console.log('Time to check if play by plays have been inserted', afterPbp-beforePbp);

						// Inserting and sending to downstream redis
						const beforeInsert = Date.now();
						await NbaPlayByPlay.query().insert(pbpToBeInserted);
						const afterInsert = Date.now();
						console.log('Time to insert', afterInsert-beforeInsert);

						// Incrementing quarter to be fetched as well as sending associated events to redis queue
						await Bluebird.each(pbpToBeInserted, async (nbaPlayByPlay: NbaPlayByPlay) => {
							const { eventMsgType,
								quarter,
								homeTeamScore,
								awayTeamScore,
								gameId } = nbaPlayByPlay;
							await incrementGameQuarterState({
								eventMsgType,
								quarter,
								homeTeamScore,
								awayTeamScore,
								gameId
							});
							await sendToRedisQueue(nbaPlayByPlay, redisQueue, queueName);
						});

					})
					lock = false;
				}
			}, randomInterval)
		} catch (err) {
			reject(err)
		}
	})
}

async function getGamesStartingBefore(date = new Date()) {
	const UTCString = date.toUTCString()
	return NbaGame.query()
		.where("status", "!=", "completed")
		.where("game_datetime", "<", UTCString)
}

async function scrapePlayByPlayCollection(gameObject) {
	const pstDate = moment.tz(_.get(gameObject, "gameDatetime"), "America/Los_Angeles").format("YYYYMMDD");
	const gameId = _.get(gameObject, "id");
	const gameStatus = _.get(gameObject, "status");

	let quarterToPull;
	if (gameStatus === "not_started") {
		quarterToPull = 1;
		const nbaGame: NbaGame = await NbaGame.query().findById(gameId);
		await nbaGame.$query().patch({
			status: "1"
		});
	} else {
		quarterToPull = parseInt(gameStatus);
	}

	const URL_TO_SCRAPE = `https://data.nba.net/prod/v1/${pstDate}/00${gameId}_pbp_${quarterToPull}.json`
	console.log('URL_TO_SCRAPE', URL_TO_SCRAPE);

	let playByPlayRaw;
	try {
		playByPlayRaw = await axios.get(URL_TO_SCRAPE);
	} catch (err) {
		console.error(err.message)
	}

	return {
		gameId,
		pstDate,
		quarterToPull,
		plays: _.get(playByPlayRaw, ["data", "plays"])
	}
}

async function incrementGameQuarterState({
	eventMsgType,
	quarter,
	homeTeamScore,
	awayTeamScore,
	gameId
}) {
	// Represents the End of the Game but going into OT
	if (eventMsgType == 13 && quarter >= 4 && homeTeamScore == awayTeamScore) {
		const nbaGame = await NbaGame.query().findById(gameId);
		console.log(`Quarter ${quarter} completed: ${gameId}`);
		await nbaGame.$query().patch({
			status: quarter + 1,
		});
		// Represents the End of the Game
	} else if (eventMsgType == 13 && quarter >= 4) {
		const nbaGame = await NbaGame.query().findById(gameId);
		console.log(`Game completed: ${gameId}`);
		await nbaGame.$query().patch({
			status: "completed",
		});
		// Represents the End of the Period
	} else if (eventMsgType == 13) {
		const nbaGame = await NbaGame.query().findById(gameId);
		console.log(`Quarter ${quarter} completed: ${gameId}`);
		await nbaGame.$query().patch({
			status: quarter + 1,
		});
	}
}

async function getPlayByPlaysToBeInserted(scrapedPlayByPlayGame, redisQueue, queueName): Promise<Partial<NbaPlayByPlay>[]>{
	const gameId = _.get(scrapedPlayByPlayGame, "gameId")
	const pstDate = _.get(scrapedPlayByPlayGame, "pstDate")
	const quarterToPull = _.get(scrapedPlayByPlayGame, "quarterToPull")
	const playByPlayCollection = _.get(scrapedPlayByPlayGame, "plays")
	let alreadyLoadedBool = false;

	const playsToBeInserted: Partial<NbaPlayByPlay>[] = [];


	await Bluebird.each(playByPlayCollection, async (playByPlay) => {
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

		// NOTE: playerId can be a teamId for team turnover/rebounds etc.
		const playByPlayInfo: Partial<NbaPlayByPlay> = {
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
			// Only use playerId if it is not a team and it is a valid string
			playerId: !_.get(teamCache, playerId) && _.size(playerId) > 0 ? playerId : undefined,
		};

		try {
			let nbaPlayByPlay = await NbaPlayByPlay.query().findOne({
				game_id: gameId,
				quarter: quarterToPull,
				description,
				clock,
				event_msg_type: eventMsgType
			});
			if (nbaPlayByPlay) {
				alreadyLoadedBool = true;
			} else {
				playsToBeInserted.push(playByPlayInfo);
			}
		} catch (err) {
			console.log('err', err);
		}
	})
	if (alreadyLoadedBool) {
		console.log(`Some events in ${gameId} were already loaded!`);
	}

	return playsToBeInserted;
}

async function sendToRedisQueue(nbaPlayByPlay: NbaPlayByPlay, redisQueue: RedisQueue, queueName) {
	if (_.get(nbaPlayByPlay, "eventMsgType") === 13 || _.get(nbaPlayByPlay, "eventMsgType") === 12) {
		await redisQueue.sendRedisQueueMsg(queueName, nbaPlayByPlay);
	}
}
