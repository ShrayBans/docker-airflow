const {
	instantiateKnex
} = require("../lib/knex.js")

let axios = require('axios');

const Bluebird = require("bluebird")
const _ = require("lodash")
// const nba_players = require('../../data/nba_players.json');

const {
	NbaPlayer,
} = require("sixthman-objection-models")

async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)

	return new Promise(async (resolve, reject) => {
		URL_TO_SCRAPE = "https://data.nba.net/prod/v2/2018/players.json"
		const nba_players = await axios.get(URL_TO_SCRAPE);
		const nbaLeaguePlayers = _.get(nba_players, ["data", "league", "standard"])
		console.log('_.size(nbaLeaguePlayers)', _.size(nbaLeaguePlayers));

		await Bluebird.each(nbaLeaguePlayers, async (player) => {
			if (_.get(player, "heightFeet")) {
				const firstName = _.get(player, "firstName")
				const lastName = _.get(player, "lastName")
				const id = _.get(player, "personId")
				const teamId = _.get(player, "teamId")
				const jerseyNum = _.get(player, "jersey")
				const isActive = _.get(player, "isActive")
				const pos = _.get(player, "pos")
				const heightFeet = _.get(player, "heightFeet")
				const heightInches = _.get(player, "heightInches")
				const weightPounds = _.get(player, "weightPounds")
				const dateOfBirth = _.get(player, "dateOfBirthUTC")

				const playerInfo = {
					firstName,
					lastName,
					id,
					teamId,
					jerseyNum,
					isActive,
					pos,
					heightFeet: heightFeet === "-" || heightFeet === "" ? 0 : heightFeet,
					heightInches: heightInches === "-" || heightInches === "" ? 0 : heightInches,
					weightPounds: weightPounds === "-" || weightPounds === "" ? 0 : weightPounds,
					dateOfBirth: dateOfBirth === "-" ? "" : dateOfBirth,
				};

				try {
					let nbaPlayer = await NbaPlayer.query().findById(id);
					if (nbaPlayer) {
						if (_.get(nbaPlayer, "teamId") != teamId) {
							console.log(`${_.get(nbaPlayer, "firstName")} ${_.get(nbaPlayer, "lastName")} has switched teams to team ${teamId}!`);
							await nbaPlayer.$query().patch({ teamId: teamId });
						}
						// console.log(`${_.get(nbaPlayer, "firstName")} ${_.get(nbaPlayer, "lastName")} already loaded!`);
					} else {
						nbaPlayer = await NbaPlayer.query().insert(playerInfo);
						console.log(`${_.get(nbaPlayer, "firstName")} ${_.get(nbaPlayer, "lastName")} loaded!`);
					}
				} catch (err) {
					console.log('err', err);
					console.log('playerInfo', playerInfo);
					reject(err)
				}
			}
		})
		return resolve(true);
	})
}

run().then(() => {
	process.exit(0)
})
.catch((err) => {
	console.error(err);
	process.exit(1)
});