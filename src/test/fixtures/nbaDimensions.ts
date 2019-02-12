import * as _ from "lodash";
import { NbaAutomatedMode, NbaAutomatedPeriod, NbaStat } from "sixthman-objection-models";

export async function bootstrapNbaAutomatedMode() {
    const nbaAutomatedModes: Partial<NbaAutomatedMode>[] = [
        { modeName: "first_stat", description: "First to Stat", sentenceFragment: "be the first to get a" },
        { modeName: "last_stat", description: "Last to Stat", sentenceFragment: "be the last to get a" },
        { modeName: "greatest_total_stat", description: "Greatest Total Stat", sentenceFragment: "get the most" },
        { modeName: "lowest_total_stat", description: "Lowest Total Stat", sentenceFragment: "get the least" },
        { modeName: "at_least", description: "At Least", sentenceFragment: "have at least" },
    ];
    await NbaAutomatedMode.query().insert(nbaAutomatedModes);
}

export async function bootstrapNbaAutomatedPeriod() {
    const nbaAutomatedPeriods: Partial<NbaAutomatedPeriod>[] = [
        { periodName: "first_quarter", description: "First Quarter", sentenceFragment: "in the first quarter" },
        { periodName: "second_quarter", description: "Second Quarter", sentenceFragment: "in the second quarter" },
        { periodName: "third_quarter", description: "Third Quarter", sentenceFragment: "in the third quarter" },
        { periodName: "fourth_quarter", description: "Fourth Quarter", sentenceFragment: "in the fourth quarter" },
        { periodName: "first_half", description: "First Half", sentenceFragment: "in the first half" },
        { periodName: "second_half", description: "Second Half", sentenceFragment: "in the second half" },
        { periodName: "full_game", description: "Full Game", sentenceFragment: "over the entire game" },
    ];
    await NbaAutomatedPeriod.query().insert(nbaAutomatedPeriods);
}

export async function bootstrapNbaAutomatedStat() {
    const nbaAutomatedStats: Partial<NbaStat>[] = [
        { abbrev: "pts", statName: "points", description: "Points", sentenceFragment: "point" },
        { abbrev: "ftm", statName: "free_throw", description: "Free Throws", sentenceFragment: "free throw" },
        {
            abbrev: "ftPct",
            statName: "free_throw_pct",
            description: "Free Throw Percentage",
            sentenceFragment: "FT percentage",
        },
        { abbrev: "fgm", statName: "field_goal", description: "Field Goals", sentenceFragment: "field goal" },
        {
            abbrev: "fgPct",
            statName: "field_goal_pct",
            description: "Field Goal Percentage",
            sentenceFragment: "FG percentage",
        },
        { abbrev: "fg3m", statName: "three_pointer", description: "Three Pointers", sentenceFragment: "three" },
        {
            abbrev: "fg3Pct",
            statName: "three_pointer_pct",
            description: "Three Pointer Percentage",
            sentenceFragment: "3 point percentage",
        },
        { abbrev: "reb", statName: "rebound", description: "Rebounds", sentenceFragment: "rebound" },
        { abbrev: "pf", statName: "foul", description: "Fouls", sentenceFragment: "foul" },
        { abbrev: "tov", statName: "turnover", description: "Turnovers", sentenceFragment: "turnover" },
        { abbrev: "eje", statName: "ejection", description: "Ejections", sentenceFragment: "ejection" },
        { abbrev: "ast", statName: "assist", description: "Assists", sentenceFragment: "assist" },
    ];
    await NbaStat.query().insert(nbaAutomatedStats);
}

export async function getNbaAutomatedModeId(modeName) {
    const nbaMode = await NbaAutomatedMode.query()
        .findOne({ mode_name: modeName })
        .throwIfNotFound();
    return _.get(nbaMode, "id");
}
export async function getNbaAutomatedPeriodId(periodName) {
    const nbaPeriod = await NbaAutomatedPeriod.query()
        .findOne({ period_name: periodName })
        .throwIfNotFound();
    return _.get(nbaPeriod, "id");
}
export async function getNbaAutomatedStatId(statName) {
    const nbaStat = await NbaStat.query()
        .findOne({ stat_name: statName })
        .throwIfNotFound();
    return _.get(nbaStat, "id");
}
