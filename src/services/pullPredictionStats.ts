import * as Bluebird from "bluebird";
import * as _ from "lodash";
import { NbaGame, NbaPlayer } from "sixthman-objection-models";

import { hmgetRedisClient } from "../lib/redisClient";

export async function pullTop4PlayersPerStat(redisClient, game: NbaGame, statAbbrevs: string[]) {
    let homeTeamPlayers;
    let awayTeamPlayers;

    let topHomeTeamPlayers: { id: number; avg: number }[];
    let topAwayTeamPlayers: { id: number; avg: number }[];
    let allPlayerIds;
    let allPlayers;
    let allPlayerStats;
    const topPlayersPerStat = {}; // { pts: [Player1, Player2], reb: ...}

    // await Bluebird.each(statAbbrevs, async stat => {
    // const pstDate = moment.tz(_.get(game, "gameDatetime"), "America/Los_Angeles").format("YYYYMMDD");
    const pstDate = "20181225";
    const homeTeamId = _.get(game, "homeTeamId");
    const awayTeamId = _.get(game, "awayTeamId");

    // Grabs redis keys from both teams to get Top 10 players per stat
    homeTeamPlayers = await hmgetRedisClient(redisClient, `teamId:${homeTeamId}:day:${pstDate}:top10`, statAbbrevs);
    awayTeamPlayers = await hmgetRedisClient(redisClient, `teamId:${awayTeamId}:day:${pstDate}:top10`, statAbbrevs);
    await Bluebird.each(statAbbrevs, async statAbbrev => {
        // Takes the top 2 of each stat from each team
        topHomeTeamPlayers = _.take(_.get(homeTeamPlayers, statAbbrev), 2);
        topAwayTeamPlayers = _.take(_.get(awayTeamPlayers, statAbbrev), 2);

        // TODO: Add Logic to Check for at least 5 FTs/FGs for percentages

        // Turns into map of playerId to stats
        allPlayerStats = _.chain(topHomeTeamPlayers.concat(topAwayTeamPlayers)).map((playerStat) => {
            return _.assign({}, playerStat, { statAbbrev });
        }).keyBy("id").value();

        allPlayerIds = _.keys(allPlayerStats);
        allPlayers = await getAllPlayersByIds(allPlayerIds); // Potential optimization is to pull all players per team and cache it in memory

        const enrichedPlayers = _.map(allPlayers, (nbaPlayer: NbaPlayer) => {
            const nbaPlayerId = _.get(nbaPlayer, "id");
            const nbaPlayerStats = _.get(allPlayerStats, nbaPlayerId)
            return _.assign({}, nbaPlayer, nbaPlayerStats)
        })

        _.set(topPlayersPerStat, statAbbrev, enrichedPlayers);
    });

    return topPlayersPerStat;
}

async function getAllPlayersByIds(playerIds) {
    return NbaPlayer.query().whereIn("id", playerIds);
}
