import { instantiateKnex } from "../lib/knex.js";
import { createRedisClient } from "../lib/redisClient";
import { RedisQueue } from "../lib/RedisQueue";
import { runScript, singlePromise } from "../lib/runUtils";
import { evaluateNbaEventMessage } from "../services/evaluateNbaEventMessage";
import * as Bluebird from "bluebird";

import * as twit from "twit";
import { size, get, orderBy, times } from "lodash";
const Twitter = new twit({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET,
});

runPlayByPlayEventConsumer().catch(err => {
    console.error(err);
    process.exit(1);
});

/**
 * This job should runPlayByPlayEventConsumer whenever games are being run.
 */
async function runPlayByPlayEventConsumer() {
    // await instantiateKnex(process.env.DATABASE_API_CONNECTION);
    // const redisQueue = new RedisQueue(process.env.REDIS_HOST, process.env.REDIS_PORT);
    // const redisClient = createRedisClient(process.env.REDIS_HOST, process.env.PORT);
    const callback = async () => {
        // Search Rate Limit: https://developer.twitter.com/en/docs/tweets/search/api-reference/get-search-tweets.html
        // Search Params: https://developer.twitter.com/en/docs/tweets/search/guides/standard-operators.html

        // Search Tweets by Hashtag
        // var params = {
        //     q: "#NBA", // REQUIRED
        //     result_type: <twit.Twitter.ResultType>"recent",
        //     lang: "en",
        //     count: 100,
        // };
        // // @ts-ignore
        // return Twitter.get("search/tweets", params, function(err, data) {
        //     // find tweets
        //     var tweet = data.statuses;
        //     console.log("tweet", tweet);
        //     console.log("tweet-size", size(tweet));
        // });
        // Search Tweets by Hashtag and Media

        let maxId;
        const tweetedBy = [];
        const hashtagsToSearch = ["#NBAFinals", "#nba"];
        const wordsToSearch = ["fouled", "hits", "throws", "slam", "dunk"];

        await Bluebird.each(times(3), async time => {
            var mediaParams = {
                q: `${size(tweetedBy) ? tweetedBy.join(" OR ") : ""} ${hashtagsToSearch.join(
                    " OR "
                )} ${wordsToSearch.join(" OR ")} filter:native_video -filter:retweets`, // REQUIRED
                result_type: <twit.Twitter.ResultType>"recent",
                lang: "en",
                count: 100,
                tweet_mode: "extended",
                max_id: maxId,
            };

            await new Promise((resolve, reject) => {
                return Twitter.get("search/tweets", mediaParams, function(err, data) {
                    // find tweets
                    // @ts-ignore
                    var tweets = data.statuses;
                    // console.log("tweet", tweets);
                    const tweetSize = size(tweets);

                    if (tweetSize === 0 || maxId === tweets[tweetSize - 1].id) {
                        console.log("Reached the end of the search feed");
                        return;
                    } else {
                        maxId = tweets[tweetSize - 1].id;
                        console.log("maxId", maxId);
                    }
                    if (err) {
                        reject(err);
                    }

                    const retweetOrdered = orderBy(tweets, "retweet_count");

                    for (let tweet of retweetOrdered) {
                        const tweetText = get(tweet, ["retweeted_status", "full_text"]) || tweet.full_text;

                        if (tweet.truncated) {
                            console.log("tweet", tweet);
                        }
                        if (tweet.retweet_count > 20) {
                            console.log("------------------------------------------");
                            console.log(
                                "tweet",
                                tweet.id,
                                tweet.retweet_count,
                                tweet.created_at,
                                tweet.user.id,
                                tweet.user.name,
                                tweetText,
                                tweetText.match(/\w*:\/\/t.co\/\w*/g)
                            );
                        }
                    }

                    setTimeout(() => {
                        resolve(retweetOrdered);
                    }, 1500);
                });
            });
        });

        // const tweetedBy = [
        //     [
        //         "from:Raptors",
        //         "from:LAClippers",
        //         "from:spurs",
        //         "from:warriors",
        //         "from:NBCSWarriors",
        //         "from:utahjazz",
        //         "from:nyknicks",
        //         "from:ATLHawks",
        //         "from:nuggets",
        //         "from:Timberwolves",
        //         "from:hornets",
        //         "from:dallasmavs",
        //         "from:PelicansNBA",
        //         "from:WashWizards",
        //         "from:DetroitPistons",
        //         "from:sixers",
        //         "from:chicagobulls",
        //     ],
        //     [
        //         "from:Lakers",
        //         "from:celtics",
        //         "from:Bucks",
        //         "from:memgrizz",
        //         "from:BrooklynNets",
        //         "from:cavs",
        //         "from:Suns",
        //         "from:MiamiHEAT",
        //         "from:Pacers",
        //         "from:okcthunder",
        //         "from:HoustonRockets",
        //         "from:OrlandoMagic",
        //         "from:trailblazers",
        //         "from:SacramentroKings",
        //         "from:NBA",
        //         "from:NBAonTNT",
        //         "from:ESPNNBA",
        //         "from:CBSSportsNBA",
        //         "from:NBATV",
        //     ],
        // ];
        // const hashtagsToSearch = [];
        // const wordsToSearch = [];

        // const searchQuery = `${size(tweetedBy[0]) ? tweetedBy[0].join(" OR ") : ""} ${
        //     size(hashtagsToSearch) ? hashtagsToSearch.join(" OR ") : ""
        // } ${size(wordsToSearch) ? wordsToSearch.join(" OR ") : ""} filter:native_video -filter:retweets`;
        // console.log("searchQuery", searchQuery);

        // let maxId;

        // await Bluebird.each(times(3), async time => {
        //     var mediaParams = {
        //         q: searchQuery, // REQUIRED
        //         result_type: <twit.Twitter.ResultType>"recent",
        //         lang: "en",
        //         count: 100,
        //         tweet_mode: "extended",
        //         max_id: maxId,
        //     };

        //     await new Promise((resolve, reject) => {
        //         return Twitter.get("search/tweets", mediaParams, function(err, data) {
        //             // find tweets
        //             // @ts-ignore
        //             var tweets = data.statuses;
        //             // console.log("tweet", tweets);
        //             const tweetSize = size(tweets);

        //             if (tweetSize === 0 || maxId === tweets[tweetSize - 1].id) {
        //                 console.log("Reached the end of the search feed");
        //                 return;
        //             } else {
        //                 maxId = tweets[tweetSize - 1].id;
        //                 console.log("maxId", maxId);
        //             }
        //             if (err) {
        //                 reject(err);
        //             }

        //             const retweetOrdered = orderBy(tweets, "retweet_count");

        //             for (let tweet of retweetOrdered) {
        //                 const tweetText = get(tweet, ["retweeted_status", "full_text"]) || tweet.full_text;

        //                 if (tweet.truncated) {
        //                     console.log("tweet", tweet);
        //                 }
        // if (tweet.retweet_count > 50) {
        //     console.log("------------------------------------------");
        //     console.log(
        //         "tweet",
        //         tweet.id,
        //         tweet.retweet_count,
        //         tweet.created_at,
        //         tweet.user.id,
        //         tweet.user.name,
        //         tweetText,
        //         tweetText.match(/\w*:\/\/t.co\/\w*/g)
        //     );
        // }
        //             }

        //             setTimeout(() => {
        //                 resolve(retweetOrdered);
        //             }, 1500);
        //         });
        //     });
        // });

        // User Lookup
        // var params = {
        //     user_id: ["2483918068", "2226717506"],
        // };
        // // @ts-ignore
        // return Twitter.get("users/lookup", params, function(err, data) {
        //     // find tweets
        //     //@ts-ignore
        //     var tweet = data;
        //     console.log("tweet", tweet);
        // });
    };
    await singlePromise(callback);

    // Filter by user
    // const stream = Twitter.stream("statuses/filter", {
    //     follow: ["1127660527285567500", "2483918068", "2226717506", "1038883928814174208"],
    // });

    // let count = 0;
    // console.log("111", 111);
    // await stream.on("tweet", function(tweet: twit.Twitter.Status) {
    //     console.log("count - ", ++count, tweet.user.id, tweet.user.name, tweet.text);
    // });
}

// Get User IDs through authentication and then stream their userIds and pick up any tweets in a certain time frame
// Get Highlight Videos between a specific time period and create streamable clips
