import * as _ from 'lodash';
import { Client } from 'pg';
import { NbaGame, NbaPlayer, NbaTeam } from 'sixthman-objection-models';

const fs = require("fs");
const path = require("path");
const pg = require("pg");
const parse = require("csv-parse");
const stringify = require("csv-stringify");
const copyFrom = require("pg-copy-streams").from;

export async function bootstrapNbaAutomatedTeam() {
    const columns = ["id", "full_name", "nickname", "url_name", "tricode", "city", "division_name", "created_at"];
    const nbaTeams = await NbaTeam.query().limit(5);
    const targetTable = "nba.team";
    if (_.size(nbaTeams) === 0) {
        await loadCsvToPgTable(targetTable, "../resources/team.csv", columns);
    }
}
export async function bootstrapNbaAutomatedPlayer() {
    const columns = [
        "id",
        "first_name",
        "last_name",
        "jersey_num",
        "pos",
        "is_active",
        "height_feet",
        "height_inches",
        "weight_pounds",
        "date_of_birth",
        "team_id",
        "updated_at",
        "created_at",
    ];
    const nbaPlayers = await NbaPlayer.query().limit(5);
    const targetTable = "nba.player";
    if (_.size(nbaPlayers) === 0) {
        await loadCsvToPgTable(targetTable, "../resources/player.csv", columns);
    }
}
export async function bootstrapNbaAutomatedGame() {
    const columns = [
        "id",
        "home_team_id",
        "away_team_id",
        "arena",
        "city",
        "game_datetime",
        "status",
        "created_at",
        "stream_link",
        "youtube_highlight",
        "boxscore_scraped",
    ];
    const nbaGames = await NbaGame.query().limit(5);
    const targetTable = "nba.game";
    if (_.size(nbaGames) === 0) {
        await loadCsvToPgTable(targetTable, "../resources/game.csv", columns);
    }
}

async function loadCsvToPgTable(targetTable, csvPath, columns) {
    return new Promise(async (resolve, reject) => {
        const client = new Client({
            connectionString: "postgres://postgres:postgres@0.0.0.0:5500/sixthman_test",
        });
        client.connect();
        const coolPath = path.join(__dirname, csvPath);

        var stream = client.query(copyFrom(`COPY ${targetTable} FROM STDIN With CSV HEADER`));
        var fileStream = fs
            .createReadStream(coolPath)
            .pipe(
                parse({
                    delimiter: ",",
                    columns: columns,
                    // Use columns: true if the input has column headers
                    // Otherwise list the input field names in the array above.
                })
            )
            .pipe(
                stringify({
                    delimiter: ",",
                    relax_column_count: true,
                    skip_empty_lines: true,
                    header: true,
                    // This names the resulting columns for the output file.
                })
            );

        // fileStream.pipe(process.stdout);
        fileStream.pipe(stream);

        fileStream.on("error", error => {
            reject(`Error in creating read stream ${error}`);
        });
        stream.on("error", error => {
            reject(`Error in creating stream ${error}`);
        });
        stream.on("end", () => {
            client.end();
            resolve(`Completed loading data into ${targetTable}`);
        });
    });
}

// export async function getNbaAutomatedGameId(modeName) {
//     const nbaGame = await NbaAutomatedGame.query()
//         .findOne({ mode_name: modeName })
//         .throwIfNotFound();
//     return _.get(nbaGame, "id");
// }
