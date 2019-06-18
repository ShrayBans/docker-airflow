const { instantiateKnex } = require("../lib/knex.js");

let axios = require("axios");

const Bluebird = require("bluebird");
const _ = require("lodash");
const { raw } = require("objection");

const { NbaPlayer } = require("sixthman-objection-models");

async function run() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);

    return new Promise(async (resolve, reject) => {
        const INPUT_TYPE = "file"; // file or API

        // const URL_TO_SCRAPE = `https://data.nba.net/prod/v2/2018/players.json`;
        // const nba_players = await axios.get(URL_TO_SCRAPE);
        // const nbaLeaguePlayers = _.get(nba_players, ["data", "league", "standard"]);

        // const nba_players = require("../resources/2019-draft-picks.json");
        const nba_players = require("../resources/nba-historical-players.json");
        const nbaLeaguePlayers = _.get(nba_players, ["players"]);
        console.log("_.size(nbaLeaguePlayers)", _.size(nbaLeaguePlayers));
        const minIdQuery = await NbaPlayer.query()
            .select(raw(` MIN( id ) AS min_id`))
            .first();
        const lowestPlayerId = _.get(minIdQuery, "minId", 0);

        await Bluebird.each(nbaLeaguePlayers, async (player, i) => {
            if (INPUT_TYPE === "file") {
                const playerId = _.get(player, "playerId") ? _.get(player, "playerId") : -(lowestPlayerId + i + 1);
                const playerName = _.get(player, "playerName");
                const firstName = _.split(playerName, " ")[0];
                const lastName = _.split(playerName, " ")
                    .slice(1)
                    .join(" ");

                const playerInfo = {
                    firstName,
                    lastName,
                    id: playerId,
                    teamId: 0,
                    jerseyNum: 0,
                    isActive: false,
                    pos: "",
                    heightFeet: 0,
                    heightInches: 0,
                    weightPounds: 0,
                    dateOfBirth: "",
                };

                let nbaPlayer = await NbaPlayer.query().findById(playerId);
                if (nbaPlayer) {
                    console.log(`${_.get(nbaPlayer, "firstName")} ${_.get(nbaPlayer, "lastName")} already loaded!`);
                } else {
                    nbaPlayer = await NbaPlayer.query().insert(playerInfo);
                    console.log(`${_.get(nbaPlayer, "firstName")} ${_.get(nbaPlayer, "lastName")} loaded!`);
                }
            } else if (INPUT_TYPE === "API") {
                if (_.get(player, "heightFeet")) {
                    const firstName = _.get(player, "firstName");
                    const lastName = _.get(player, "lastName");
                    const id = _.get(player, "personId");
                    const teamId = _.get(player, "teamId");
                    const jerseyNum = _.get(player, "jersey");
                    const isActive = _.get(player, "isActive");
                    const pos = _.get(player, "pos");
                    const heightFeet = _.get(player, "heightFeet");
                    const heightInches = _.get(player, "heightInches");
                    const weightPounds = _.get(player, "weightPounds");
                    const dateOfBirth = _.get(player, "dateOfBirthUTC");

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
                            if (_.get(nbaPlayer, "teamId") != _.get(playerInfo, "teamId")) {
                                const newTeamId = _.get(playerInfo, "teamId") ? _.get(playerInfo, "teamId") : 0;
                                console.log(
                                    `${_.get(nbaPlayer, "firstName")} ${_.get(
                                        nbaPlayer,
                                        "lastName"
                                    )} has switched teams to team ${newTeamId}!`
                                );
                                await nbaPlayer.$query().patch({
                                    teamId: newTeamId,
                                });
                            }
                            // console.log(`${_.get(nbaPlayer, "firstName")} ${_.get(nbaPlayer, "lastName")} already loaded!`);
                        } else {
                            nbaPlayer = await NbaPlayer.query().insert(playerInfo);
                            console.log(`${_.get(nbaPlayer, "firstName")} ${_.get(nbaPlayer, "lastName")} loaded!`);
                        }
                    } catch (err) {
                        console.log("err", err);
                        console.log("playerInfo", playerInfo);
                        reject(err);
                    }
                }
            }
        });
        return resolve(true);
    });
}

run()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
