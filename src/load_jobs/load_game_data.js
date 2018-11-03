const {
	instantiateKnex
} = require("../lib/knex.js")
instantiateKnex(process.env.DATABASE_API_CONNECTION)

let nba_schedule = require('../../data/nba_schedule.json');
const _ = require("lodash")

const {
	NbaGame,
} = require("sixthman-objection-models")
const moment = require('moment-timezone');


async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)

	const nbaScheduleGamesPerMonth = _.get(nba_schedule, "lscd")
	await _.forEach(nbaScheduleGamesPerMonth, async (monthOfNbaSchedule) => {
		await _.forEach(_.get(monthOfNbaSchedule, ["mscd", "g"]), async (game) => {
			const id = _.get(game, "gid");
			const awayTeamId = _.get(game, ["v", "tid"]);
			const homeTeamId = _.get(game, ["h", "tid"]);
			const easternGameTime = _.get(game, "etm");
			const arena = _.get(game, "an");
			const city = _.get(game, "ac");

			const easternFormattedTime = moment.tz(easternGameTime, 'America/New_York').format()

			const gameInfo = {
				id,
				gameDatetime: easternFormattedTime,
				arena,
				homeTeamId,
				awayTeamId,
				city
			}
			try {
				let nbaGame = await NbaGame.query().findById(id);
				if (nbaGame) {
					console.log(`${game.v.ta} vs ${game.h.ta} already loaded!`);

				} else {
					nbaGame = await NbaGame.query().insert(gameInfo);
					console.log(`${game.v.ta} vs ${game.h.ta} loaded!`);
				}
			} catch (err) {
				console.log('err', err);
				console.log('gameInfo', gameInfo);
			}
		})
	})

}

run().then(() => {
	process.exit(0)
})
.catch(() => {
	process.exit(1)
});