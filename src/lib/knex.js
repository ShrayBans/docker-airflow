const knex = require("knex");
const {
    Base
} = require("sixthman-objection-models")

module.exports = {
    instantiateKnex: async function(databaseConnection) {

        const knexConfig = {
            client: "postgresql",
            connection: databaseConnection || "postgres://postgres:postgres@0.0.0.0:5500/sixthman",
            pool: {
                min: 2,
                max: 10,
            },
        }
        await Base.knex(knex(knexConfig));
    },
    test: {
        client: "postgresql",
        connection: "postgres://postgres:postgres@0.0.0.0:5500/sixthman_test",
        pool: {
            min: 2,
            max: 10,
        },
    },
}