const {
	instantiateKnex
} = require("../lib/knex.js")
const {
	createRedisClient
} = require("../lib/redisClient.js")

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
 * calculate top 5 for each category for a team per day over last 5 days
 * store in redis key `teamId:{WARRIORS_ID}:day:20181010:top5`: { 3 Pointers: [{ name: “Stephen Curry”, avg: 6.3, id: 912843 }] }
 */

// Go through all of the teams and store in an array of teamIds [123, 124, ...]
// Iterate through each team and pull last 7 games of that team
// From last 7 games, pull all box scores scraped
// Calculate averages per player

async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)
	const redisClient = createRedisClient(process.env.REDIS_HOST)

	const pstDate = moment.tz(new Date(), "America/Los_Angeles").format("YYYYMMDD");
	const fields = ["fgm", "fga", "fg3m", "fg3a", "ftm", "fta","oreb", "dreb", "reb", "ast", "tov", "stl", "blk", "pf", "pts", "plusMinus", "nbaFantasyPts" ];

	return new Promise(async (resolve, reject) => {
		try {
			const teamIds = await getDistinctTeams();

			const allTeamPlayerMap = {};
			const allTeamTop10Players = {};
			await Bluebird.map(teamIds, async (teamId) => {
				const gameIds = await getLast7Games(teamId);
				const boxScoresPerPlayer = await getBoxScoresPerGames(teamId, gameIds);

				const playerMap = {};
				const playerTop10Map = {};

				// Calculate Sums
				_.forEach(boxScoresPerPlayer, (boxScoreObject) => {
					const playerId = _.get(boxScoreObject, "playerId");

					_.forEach(boxScoreObject, (value, key) => {
						if (_.includes(fields, key) || key === "gamesPlayed") {
							_.set(playerMap, [playerId, key], (_.get(playerMap, [playerId, key], 0) + Number(value)))
						}
					})
				})

				// Calculate Averages and Percentages
				// i.e. playerStatObj {"playerId":9770268,"fgm":45,"fga":110,"fg3m":11,"fg3a":38,"oreb":2,"dreb":10,"reb":12,"ast":17,"tov":14,"stl":8,"blk":5,"pf":16,"pts":123,"plusMinus":-8,"nbaFantasyPts":187.89999999999998,"gamesPlayed":6    }
				_.forEach(playerMap, (playerStatObj, playerId) => {
					// Averages
					_.forEach(playerStatObj, (value, key) => {
						if (_.includes(fields, key)) {
							_.set(playerMap, [playerId, key], (_.get(playerMap, [playerId, key], 0) / (_.get(playerMap, [playerId, "gamesPlayed"], 0))));
						}
					});

					// Percentages
					_.set(playerMap, [playerId, "fgPct"], _.get(playerMap, [playerId, "fgm"], 0) / _.get(playerMap, [playerId, "fga"], 1))
					if (_.get(playerMap, [playerId, "ftm"])) {
						_.set(playerMap, [playerId, "ftPct"], _.get(playerMap, [playerId, "ftm"], 0) / _.get(playerMap, [playerId, "fta"], 1))
					}
					_.set(playerMap, [playerId, "fg3Pct"], _.get(playerMap, [playerId, "fg3m"], 0) / _.get(playerMap, [playerId, "fg3a"], 1))
				});

				// Calculate top 10 of each category
				_.forEach(playerMap, (playerStatObj, playerId) => {
					_.forEach(playerStatObj, (value, key) => {
						if (!_.get(playerTop10Map, key)) {
							_.set(playerTop10Map, key, [{ id: Number(playerId), avg: value || 0 }])
						} else {
							playerTop10Map[key].push({ id: Number(playerId), avg: value || 0 });
						}
					});
				});

				_.forEach(playerTop10Map, (playerArr, key) => {
					const sortedPlayerArr = _.orderBy(playerArr, ["avg"], ["desc"]);
					_.set(playerTop10Map, key, sortedPlayerArr);
				});

				_.set(allTeamPlayerMap, teamId, playerMap);
				_.set(allTeamTop10Players, teamId, playerTop10Map);

				await hmsetRedisClient(redisClient, `teamId:${teamId}:day:${pstDate}:top10`, playerTop10Map);
				await hmsetRedisClient(redisClient, `teamId:${teamId}:day:${pstDate}:playerstats`, playerMap);
			})

			return resolve(true)
		} catch (err) {
			reject(err)
		}
	})
}

async function getDistinctTeams() {
	const nbaTeams = await NbaTeam.query()
		.distinct("id");
	return _.map(nbaTeams, "id");
}
async function getLast7Games(teamId) {
	const nbaGames = await NbaGame.query()
		.where("status", "=", "completed")
		.where(builder => {
			builder.where("home_team_id", "=", teamId).orWhere("away_team_id", "=", teamId)
		})
		.orderBy("game_datetime", "desc")
		.select("id")
		.limit(10)
	return _.map(nbaGames, "id");
}
async function getBoxScoresPerGames(teamId, gameIds) {
	const nbaBoxScores = await NbaBoxScore.query()
		.where({ "team_id": teamId })
		.whereIn("game_id", gameIds)
	return _.map(nbaBoxScores, (boxScore) => ({ ...boxScore, gamesPlayed: 1 }));
}

async function hmsetRedisClient(redisClient, key, object) {
	const flattenedObject = _.flatMap(object, (value, key) => {
		return [key, JSON.stringify(value)];
	});
	const hmsetObject = [key].concat(flattenedObject);

	return new Promise((resolve, reject) => {
        //@ts-ignore
        redisClient.hmset(hmsetObject, (err, data) => {
            if (err) {
				console.error('err', err);
                reject(err);
            }

            return resolve(data);
        });
    });
}