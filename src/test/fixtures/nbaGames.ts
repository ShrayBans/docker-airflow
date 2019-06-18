import * as _ from "lodash";
import { NbaGame, NbaPlayer, NbaTeam } from "sixthman-objection-models";
import { loadCsvToPgTable } from "../../lib/csvUtils";

export async function bootstrapNbaTeam() {
    console.log("Inserting Team Info into PG");
    const columns = ["id", "full_name", "nickname", "url_name", "tricode", "city", "division_name", "created_at"];
    const nbaTeams = await NbaTeam.query().limit(5);
    const targetTable = "nba.team";
    if (_.size(nbaTeams) === 0) {
        await loadCsvToPgTable(targetTable, "../test/resources/team.csv", columns);
    }
}
export async function bootstrapNbaPlayer() {
    console.log("Inserting Player Info into PG");
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
        await loadCsvToPgTable(targetTable, "../test/resources/player.csv", columns);
    }
}
export async function bootstrapNbaGame() {
    console.log("Inserting Game Info into PG");
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
        await loadCsvToPgTable(targetTable, "../test/resources/game.csv", columns);
    }
}
