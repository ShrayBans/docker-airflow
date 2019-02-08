import * as _ from 'lodash';
import { NbaAutomatedMode, NbaAutomatedPeriod, NbaStat } from 'sixthman-objection-models';

export async function bootstrapNbaAutomatedMode() {
    const nbaAutomatedModes: Partial<NbaAutomatedMode>[] = [
        { modeName: "first_stat", description: "First to Stat" },
        { modeName: "last_stat", description: "Last to Stat" },
        { modeName: "greatest_total_stat", description: "Greatest Total Stat" },
        { modeName: "lowest_total_stat", description: "Lowest Total Stat" },
        { modeName: "at_least", description: "At Least" },
    ];
    await NbaAutomatedMode.query().insert(nbaAutomatedModes);
}

export async function bootstrapNbaAutomatedPeriod() {
    const nbaAutomatedPeriods: Partial<NbaAutomatedPeriod>[] = [
        { periodName: "first_quarter", description: "First Quarter" },
        { periodName: "second_quarter", description: "Second Quarter" },
        { periodName: "third_quarter", description: "Third Quarter" },
        { periodName: "fourth_quarter", description: "Fourth Quarter" },
        { periodName: "first_half", description: "First Half" },
        { periodName: "second_half", description: "Second Half" },
        { periodName: "full_game", description: "Full Game" },
    ];
    await NbaAutomatedPeriod.query().insert(nbaAutomatedPeriods);
}

export async function bootstrapNbaAutomatedStat() {
    const nbaAutomatedStats: Partial<NbaStat>[] = [
        { statName: "points", description: "Points" },
        { statName: "free_throw", description: "Free Throw" },
        { statName: "free_throw_pct", description: "Free Throw Percentage" },
        { statName: "field_goal", description: "Field Goal" },
        { statName: "field_goal_pct", description: "Field Goal Percentage" },
        { statName: "three_pointer", description: "Three Pointer" },
        { statName: "three_pointer_pct", description: "Three Pointer Percentage" },
        { statName: "rebound", description: "Rebound" },
        { statName: "foul", description: "Foul" },
        { statName: "turnover", description: "Turnover" },
        { statName: "ejection", description: "Ejection" },
        { statName: "assist", description: "Assist" },
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
