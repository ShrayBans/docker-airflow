let cheerio = require('cheerio');
const axios = require("axios")
const _ = require("lodash")
const moment = require('moment-timezone');
const Bluebird = require("bluebird")

const {
	NbaGame,
	RedditPost
} = require("sixthman-objection-models")

const {
	instantiateKnex
} = require("../lib/knex.js")

const DATABASE_CONN = process.env.DATABASE_API_CONNECTION;


run().then(() => {
	process.exit(0)
}).catch(() => {
	process.exit(1)
});

async function getGamesStartingBefore(date = new Date()) {
	const UTCString = date.toUTCString()
	return NbaGame.query()
		.eager('[homeTeam, awayTeam]')
		.where("status", "!=", "completed")
		.where("game_datetime", "<", UTCString)
		.whereNull("stream_link")
}

async function getRedditPostsAfter(date = new Date()) {
	const UTCString = date.toUTCString()
	return RedditPost.query()
		.where({
			sub_reddit: "nbastreams"
		})
		.where("post_timestamp", ">", UTCString)
}

async function run() {
	await instantiateKnex(DATABASE_CONN)
	let redditPost;
	let htmlToScrape;
	let nbaStreamUrls;

	return new Promise(async (resolve) => {
		console.log('Starting Reddit NBA scraper!');

		// Check all games that are in the next 2 hours and don't have a reddit_link
		const oneDayBeforeDate = moment(new Date()).subtract(1, 'day').toDate()
		const nbastreamPosts = await getRedditPostsAfter(oneDayBeforeDate)
		const nbaStreamPostsMap = _.keyBy(nbastreamPosts, "title")
		const nbaStreamPostsTitles = _.map(nbastreamPosts, "title")

		const thirtyMinuteAfterDate = moment(new Date()).add(30, 'minutes').toDate()
		const currentNbaGames = await getGamesStartingBefore(thirtyMinuteAfterDate);

		const redditNbaStreamGameCollection = _.map(currentNbaGames, (nbaGame) => {
			const queryStringTitle = _.get(nbaGame, ["awayTeam", "fullName"]) + " @ " + _.get(nbaGame, ["homeTeam", "fullName"])

			const nbaGameTitle = _.find(nbaStreamPostsTitles, (nbaStreamTitle) => {
				return _.includes(nbaStreamTitle, queryStringTitle)
			})

			if (!nbaGameTitle) {
				console.log(`NBA Game not loaded: ${queryStringTitle}`);
			} else {
				console.log('nbaGameTitle', nbaGameTitle);
			}
			const nbaStreamsRedditPost = _.get(nbaStreamPostsMap, nbaGameTitle);
			const redditPostId = _.get(nbaStreamsRedditPost, "redditPostId")
			const redditPostUrl = _.get(nbaStreamsRedditPost, "url")

			return {
				redditPostId,
				redditPostUrl,
				nbaGame,
			}
		})

		await Bluebird.each(redditNbaStreamGameCollection, async (redditNbaStreamGame) => {
			const redditPostUrl = _.get(redditNbaStreamGame, "redditPostUrl")
			const redditPostId = _.get(redditNbaStreamGame, "redditPostId")
			const nbaGame = _.get(redditNbaStreamGame, "nbaGame")
			const url = `https://old.reddit.com${redditPostUrl}`

			if (url) {
				htmlToScrape = await axios.get(url);
				nbaStreamUrls = extractPostData(htmlToScrape)

				const coreStreamUrls = await Bluebird.map(nbaStreamUrls, async (nbaStreamUrl) => {
					htmlToScrape = await axios.get(nbaStreamUrl);
					return extractStreamData(htmlToScrape)
				})

				if (_.size(coreStreamUrls) > 0) {
					const sortedCoreStreamUrls = coreStreamUrls.slice().sort((a, b) => a.localeCompare(b, undefined, {
						numeric: true
					}))

					// Update the NbaGame with streams link
					await nbaGame.$query().patch({
						stream_link: _.head(sortedCoreStreamUrls)
					});
				} else {
					console.log('No NBA Stream Urls found on the page');
				}
			} else {
				console.log('No url defined for' + _.get(nbaGame, ["awayTeam", "fullName"]) + " @ " + _.get(nbaGame, ["homeTeam", "fullName"]));
			}
		})

		return resolve(true)
	})

}

function extractPostData(htmlToScrape) {
	const streamUrls = [];
	let streamUrl;
	const $ = cheerio.load(_.get(htmlToScrape, "data"));

	$(".commentarea .thing").each((i, thing) => {
		const redditUser = $(thing).attr("data-author")
		if (redditUser === "rippledotis") {
			const links = $(thing).find(".entry form .md-container a")
			links.each((i, link) => {
				streamUrl = $(link).attr("href")
				streamUrls.push(streamUrl);
			})
		}
	})

	return streamUrls;
}

function extractStreamData(htmlToScrape) {
	const $ = cheerio.load(_.get(htmlToScrape, "data"));
	let streamUrl;

	streamUrl = $("#t3-content .embed-container iframe").attr("src")

	return streamUrl;
}

async function insertNbaGameCollection(scrapedPostCollection) {
	await _.forEach(scrapedPostCollection, async (redditPostData) => {
		const redditPostId = _.get(redditPostData, "redditPostId")

		try {
			let redditPost = await NbaGame.query().findOne({
				reddit_post_id: redditPostId,
			});
			if (redditPost) {

				console.log(`${_.get(redditPost, "redditUser")} - ${_.get(redditPost, "redditPostId")} - already loaded!`);
			} else {
				redditPost = await NbaGame.query().insert(redditPostData);
				console.log(`LOADED: ${_.get(redditPost, "redditUser")} - ${_.get(redditPost, "redditPostId")}!`);
			}

		} catch (err) {
			console.log('err', err);
		}
	})
}