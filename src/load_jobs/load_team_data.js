const {
	instantiateKnex
} = require("../lib/knex.js")

let axios = require('axios');

const _ = require("lodash")

const {
	NbaTeam,
} = require("sixthman-objection-models")

async function run() {
	await instantiateKnex(process.env.DATABASE_API_CONNECTION)

	// URL_TO_SCRAPE = "https://data.nba.net/prod/v2/2018/teams.json"
	// const nba_teams = await axios.get(URL_TO_SCRAPE);
	const nba_teams = require('../../data/nba_teams.json');

	const nbaLeagueTeams = _.get(nba_teams, "league")

	await _.forEach(nbaLeagueTeams, async (teams) => {
		await _.forEach(teams, async (team) => {
			if (_.get(team, "isNBAFranchise") && _.get(team, "divName")) {
				const fullName = _.get(team, "fullName")
				const nickname = _.get(team, "nickname")
				const urlName = _.get(team, "urlName")
				const tricode = _.get(team, "tricode")
				const city = _.get(team, "city")
				const id = _.get(team, "teamId")
				const divisionName = _.get(team, "divName")

				const teamInfo = {
					fullName,
					nickname,
					urlName,
					tricode,
					city,
					id,
					divisionName,
				};

				const nbaTeam = await NbaTeam.query().insert(teamInfo);
				console.log(`${_.get(nbaTeam, "fullName")} loaded!`);
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