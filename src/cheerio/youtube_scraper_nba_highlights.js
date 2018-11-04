let cheerio = require('cheerio');
const axios = require("axios")
const _ = require("lodash")
const Bluebird = require("bluebird")
const moment = require('moment-timezone');

const {
	NbaGame
} = require("sixthman-objection-models")

const {
	instantiateKnex
} = require("../lib/knex.js")


const DATABASE_CONN = process.env.DATABASE_API_CONNECTION;


run().then(() => {
	process.exit(0)
}).catch((err) => {
	console.error(err);
	process.exit(1)
});

async function run() {
	await instantiateKnex(DATABASE_CONN)
	let htmlToScrape;
	let pageUrl;
	let gameSearchString;
	let gameVsString;
	let nbaHighlight;

	return new Promise(async (resolve, reject) => {
		try {
			console.log('Starting Youtube NBA Highlights scraper!');

			// Pull all of the Nba games that are done and don't have highlights
			const gamesToScrape = await getCompletedGames();

			const enrichedGamesToScrape = _.map(gamesToScrape, (gameObject) => {
				gameVsString = _.get(gameObject, ["awayTeam", "fullName"]) + " vs " + _.get(gameObject, ["homeTeam", "fullName"]) + " Full Game Highlights"
				gameSearchString = _.chain(gameVsString).split(" ").join("+").value()
				return { ...gameObject, gameSearchString };
			})
			const firstTenGames = _.slice(enrichedGamesToScrape, 0, 10);

			const nbaHighlights = await Bluebird.map(firstTenGames, async (gameObject) => {
				const gameSearchString = _.get(gameObject, "gameSearchString")
				pageUrl = `https://www.youtube.com/results?search_query=${gameSearchString}&page=&utm_source=opensearch`
				console.log('pageUrl', pageUrl);

				htmlToScrape = await axios.get(pageUrl);
				nbaHighlight = extractFeedData(htmlToScrape, gameObject)

				if (!_.get(nbaHighlight, "gameId")) {
					nbaHighlight = {
						gameId: _.get(gameObject, "id"),
						gameDatetime: _.get(gameObject, "gameDatetime"),
						notFound: true
					};
				}

				return nbaHighlight;
			})

			await Bluebird.each(nbaHighlights, async (nbaHighlight) => {
				await updateNbaGameWithHighlights(nbaHighlight);
			})

			return resolve(true)
		} catch (err) {
			reject(err)
		}
	});
}

async function getCompletedGames() {
	return NbaGame.query()
		.eager('[homeTeam, awayTeam]')
		.where("status", "=", "completed")
		.whereNull("youtube_highlight")
}

function extractFeedData(htmlToScrape, gameObject) {
	const $ = cheerio.load(_.get(htmlToScrape, "data"));
	const gameId = _.get(gameObject, "id");
	const homeTeamName = _.get(gameObject, ["homeTeam", "fullName"]);
	const awayTeamName = _.get(gameObject, ["awayTeam", "fullName"]);
	const gameDatetime = _.get(gameObject, "gameDatetime")
	const gameDateDots = moment.tz(gameDatetime, "America/Los_Angeles").format("MM.DD.YYYY")
	const gameDateWords = moment.tz(gameDatetime, "America/Los_Angeles").format("MMM D, YYYY")
	const postList = [];
	let post = {}

	const teamMapping = {
		"Los Angeles Clippers": "LA Clippers",
		"Los Angeles Lakers": "LA Lakers",
		"Philadelphia 76ers": "Philadelphia Sixers",
	}
	const modifiedHomeTeamName = _.hasIn(teamMapping, homeTeamName) ? _.get(teamMapping, homeTeamName) : homeTeamName;
	const modifiedAwayTeamName = _.hasIn(teamMapping, awayTeamName) ? _.get(teamMapping, awayTeamName) : awayTeamName;

	$("#content a").each((i, youtubePost) => {
		const title = $(youtubePost).attr("title");
		const href = $(youtubePost).attr("href")

		// MLG Highlights
		if ((_.includes(title, gameDateWords) && _.includes(title, modifiedAwayTeamName) && _.includes(title, modifiedHomeTeamName)) ||
			((_.includes(title, gameDateDots) && _.includes(title, awayTeamName)) && _.includes(title, homeTeamName))) {
			post = {
				gameId,
				title,
				href,
			}
			postList.push(post)
		}
		// Rapid Highlights
		if ((_.includes(title, gameDateDots) && _.includes(title, modifiedAwayTeamName) && _.includes(title, modifiedHomeTeamName) ||
		 	(_.includes(title, gameDateDots) && _.includes(title, awayTeamName)) && _.includes(title, homeTeamName))) {
			post = {
				gameId,
				title,
				href,
			}
			postList.push(post)
		}
	})

	console.log(`Found ${_.size(postList)} game highlights for ${homeTeamName + " vs " + awayTeamName} on ${gameDateDots}`);
	// Only take 1 out of any games found
	return _.head(postList);
}




async function updateNbaGameWithHighlights(scrapedNbaHighlights) {
	const notFoundFlag = _.get(scrapedNbaHighlights, "notFound");

	const nbaGameTitle = _.get(scrapedNbaHighlights, "title");
	const nbaGameId = _.get(scrapedNbaHighlights, "gameId");
	const nbaGameYoutubeHref = _.get(scrapedNbaHighlights, "href");

	try {
		let nbaGame = await NbaGame.query().findOne({
			id: nbaGameId,
		});

		if (notFoundFlag) {
			const gameDatetime = _.get(scrapedNbaHighlights, "gameDatetime");
			const dayDiff = moment(new Date()).diff(moment(gameDatetime), "days");
			if (dayDiff >= 4) {
				console.log(`Game id: ${nbaGameId} is being archived after not finding a highlight for ${dayDiff} days`)
				nbaGame = await nbaGame.$query().patchAndFetch({ youtubeHighlight: "not_found" });
			}
		} else {
			nbaGame = await nbaGame.$query().patchAndFetch({ youtubeHighlight: nbaGameYoutubeHref });
			console.log(`LOADED: NBA Highlight for ${nbaGameTitle} at http://youtube.com${nbaGameYoutubeHref}!`);
		}

	} catch (err) {
		console.log('err', err);
	}
}