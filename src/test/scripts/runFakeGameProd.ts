import { runScript, singlePromise } from "../../lib/runUtils";
import { instantiateKnex } from "../../lib/knex";
import { fakeGameRunner } from "../fakeGameRunner";


runScript(runFakeGameProd);

async function runFakeGameProd() {
    await instantiateKnex(process.env.DATABASE_API_CONNECTION);

    const queueName = "test-pbp";
    const pathToFakeGameData = "./resources/warriors-lakers.json";

    const mainCallback = async () => {
        await fakeGameRunner(queueName, pathToFakeGameData, true);
    };

    await singlePromise(mainCallback);
}