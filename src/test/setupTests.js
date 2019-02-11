const Promise = require("bluebird");
const _ = require("lodash")

// process.env.DEBUG = "knex:query"

// const td = require("testdouble");
// td.config({ promiseConstructor: Promise });
const {
    Model
} = require("objection");
const Knexfile = require("../lib/knex");
const knex = require("knex")(Knexfile["test"]);

Model.knex(knex);

jest.setTimeout(300000);
// global.td = td;

const wipeTable = transaction =>
    Promise.coroutine(function*({
        schema,
        tableName
    }) {
        yield transaction.raw(`ALTER TABLE ${schema}.${tableName} DISABLE trigger ALL;`);
        yield transaction(`${schema}.${tableName}`).delete();
        yield transaction.raw(`ALTER TABLE ${schema}.${tableName} ENABLE trigger ALL;`);
    });

const tablesToClean = new Set();
const tableNameFromKnexInsertRegex = /insert into "(\w+)?(?:"\.")?(\w+)?"/;

beforeAll(() => {
    knex.on("query", ({
        method,
        sql
    }) => {
        if (method === "insert") {
            let [, schema, tableName] = sql.match(tableNameFromKnexInsertRegex);
            if (!tableName) {
                [schema, tableName] = ["core", schema];
            }
            const tablesToIgnore = ["player", "team", "game", , "play_by_play"]
            // tablesToIgnore.push(["stat", "automated_mode", "automated_period"])
            if (!(schema == "nba" && _.includes(tablesToIgnore, tableName))) {
                tablesToClean.add({
                    schema,
                    tableName
                });
            }
        }
    });
});

afterEach(() => {
    // td.reset();
    return knex.transaction(trx => Promise.each(Array.from(tablesToClean), wipeTable(trx))).then(() => {
        tablesToClean.clear();
    });
});

afterAll(() => knex.destroy());