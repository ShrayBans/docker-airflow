let cheerio = require('cheerio');
const axios = require("axios")
const _ = require("lodash")

const {
	RedditPost
} = require("sixthman-objection-models")

const {
	instantiateKnex
} = require("../lib/knex.js")
const {
	getRandomInterval,
} = require("../lib/utils")


const SUBREDDIT = process.env.SUBREDDIT || "lakers"
const TIME_INTERVAL = Number(process.env.TIME_INTERVAL) || 10000;
const SCRAPING_MODE = process.env.SCRAPING_MODE || "pages";
const DATABASE_CONN = process.env.DATABASE_API_CONNECTION;
let PAGES_TO_SCRAPE = Number(process.env.PAGES) || 10;

let foundOldPosts = false;

run().then(() => {
	process.exit(0)
}).catch((err) => {
	console.error(err);
	process.exit(1)
});

async function run() {
	await instantiateKnex(DATABASE_CONN)
	let redditFeed;
	let lastElementId;
	let htmlToScrape;
	let paginatedUrl;

	// If you are scraping reddit by pages, continue from the last page you left off on by taking the latest postTimestamp
	if (SCRAPING_MODE === "pages") {
		const latestPost = await RedditPost.query().where({
			sub_reddit: SUBREDDIT
		}).orderBy("post_timestamp").first()
		console.log('latestPost', latestPost);
		redditFeed = [latestPost];
	}
	return new Promise((resolve, reject) => {
		try {
			console.log('Starting Reddit NBA scraper!');

			const interval = setInterval(async () => {
					if (PAGES_TO_SCRAPE <= 0 || foundOldPosts) {
						console.log("Max page limit has been reached or the scraper has found old posts!");
						clearInterval(interval)
						return resolve(true)
					}

					lastElementId = _.get(_.last(redditFeed), "redditPostId", "")
					PAGES_TO_SCRAPE--;
					paginatedUrl = `https://old.reddit.com/r/${SUBREDDIT}/?count=25&after=${lastElementId}`
					console.log('paginatedUrl', paginatedUrl);

					htmlToScrape = await axios.get(paginatedUrl);
					redditFeed = extractFeedData(htmlToScrape)

					await insertRedditPostCollection(redditFeed);

				},
				getRandomInterval(TIME_INTERVAL, TIME_INTERVAL))
			} catch (err) {
				reject(err)
			}
		})
}

function extractFeedData(htmlToScrape) {
	const $ = cheerio.load(_.get(htmlToScrape, "data"));

	const feedList = [];
	let feed = {}
	$("#siteTable .thing").each((i, thing) => {
		const title = $(thing).find("p.title a.title").text()
		const url = $(thing).find("p.title a.title").attr("href")
		const domain = $(thing).find("p.title span.domain a").attr("href")
		const postTimestamp = $(thing).attr("data-timestamp")
		const redditUser = $(thing).attr("data-author")
		const redditPostId = $(thing).attr("data-fullname")

		feed = {
			title,
			url,
			domain: domain ? domain.replace("/domain/", "").replace(/\/$/, "") : domain,
			postTimestamp: postTimestamp ? new Date(Number(postTimestamp)).toISOString() : postTimestamp,
			redditUser,
			redditPostId,
			subReddit: SUBREDDIT,
		};

		feedList.push(feed)
	})

	return feedList;
}




async function insertRedditPostCollection(scrapedPostCollection) {
	await _.forEach(scrapedPostCollection, async (redditPostData) => {
		const redditPostId = _.get(redditPostData, "redditPostId")

		try {
			let redditPost = await RedditPost.query().findOne({
				reddit_post_id: redditPostId,
			});
			if (redditPost) {
				if (SCRAPING_MODE === "latest") { // this will stop the scraper once a found post has been found
					foundOldPosts = true;
				}
				console.log(`${_.get(redditPost, "redditUser")} - ${_.get(redditPost, "redditPostId")} - already loaded!`);
			} else {
				redditPost = await RedditPost.query().insert(redditPostData);
				console.log(`LOADED: ${_.get(redditPost, "redditUser")} - ${_.get(redditPost, "redditPostId")}!`);
			}

		} catch (err) {
			console.log('err', err);
		}
	})
}