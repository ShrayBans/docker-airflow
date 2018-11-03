let cheerio = require('cheerio');
const axios = require("axios")
const _ = require("lodash")

const {
	InstagramPost
} = require("sixthman-objection-models")

const {
	instantiateKnex
} = require("../lib/knex.js")
const {
	getRandomInterval,
} = require("../lib/utils")


const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME || "nbamemes"
const TIME_INTERVAL = Number(process.env.TIME_INTERVAL) || 10000;
const SCRAPING_MODE = process.env.SCRAPING_MODE || "pages";
const DATABASE_CONN = process.env.DATABASE_API_CONNECTION;
let PAGES_TO_SCRAPE = Number(process.env.PAGES) || 10;

let foundOldPosts = false;

run().then(() => {
	process.exit(0)
}).catch(() => {
	process.exit(1)
});

async function run() {
	await instantiateKnex(DATABASE_CONN)
	let redditFeed;
	let lastElementId;
	let htmlToScrape;
	let paginatedUrl;

	// If you are scraping reddit by pages, continue from the last page you left off on by taking the latest postTimestamp
	// if (SCRAPING_MODE === "pages") {
	// 	const latestPost = await InstagramPost.query().where({
	// 		sub_reddit: SUBREDDIT
	// 	}).orderBy("post_timestamp").first()
	// 	console.log('latestPost', latestPost);
	// 	redditFeed = [latestPost];
	// }

	return new Promise(async (resolve) => {
		console.log('Starting Instagram NBA scraper!');

		// const interval = setInterval(async () => {
		if (PAGES_TO_SCRAPE <= 0 || foundOldPosts) {
			console.log("Max page limit has been reached or the scraper has found old posts!");
			clearInterval(interval)
			return resolve(true)
		}

		lastElementId = _.get(_.last(redditFeed), "redditPostId", "")
		PAGES_TO_SCRAPE--;
		paginatedUrl = `https://www.instagram.com/${INSTAGRAM_USERNAME}/`
		console.log('paginatedUrl', paginatedUrl);

		htmlToScrape = await axios.get(paginatedUrl);
		redditFeed = extractFeedData(htmlToScrape)

		// await insertInstagramPostCollection(redditFeed);

		// },
		// getRandomInterval(TIME_INTERVAL, TIME_INTERVAL))



	})

}

function extractFeedData(htmlToScrape) {
	const $ = cheerio.load(_.get(htmlToScrape, "data"));
	console.log('_.get(htmlToScrape, "data")', _.get(htmlToScrape, "data"));

	const feedList = [];
	let feed = {}
	$(".Nnq7C weEfm").each((i, thing) => {
		const title = $(thing).text()
		console.log('title', title);

	})

	return feedList;
}




async function insertInstagramPostCollection(scrapedPostCollection) {
	await _.forEach(scrapedPostCollection, async (redditPostData) => {
		const redditPostId = _.get(redditPostData, "redditPostId")

		try {
			let redditPost = await InstagramPost.query().findOne({
				reddit_post_id: redditPostId,
			});
			if (redditPost) {
				if (SCRAPING_MODE === "latest") { // this will stop the scraper once a found post has been found
					foundOldPosts = true;
				}
				console.log(`${_.get(redditPost, "redditUser")} - ${_.get(redditPost, "redditPostId")} - already loaded!`);
			} else {
				redditPost = await InstagramPost.query().insert(redditPostData);
				console.log(`LOADED: ${_.get(redditPost, "redditUser")} - ${_.get(redditPost, "redditPostId")}!`);
			}

		} catch (err) {
			console.log('err', err);
		}
	})
}