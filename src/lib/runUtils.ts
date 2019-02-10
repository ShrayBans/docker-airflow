export async function singlePromise(callback: Function) {
    return new Promise(async (resolve, reject) => {
        try {
            // Keep going until games are over

            await callback();

            return resolve(true);
        } catch (err) {
            reject(err);
        }
    });
}

export async function loopingPromise(exitCallback: Function, callback: Function, intervalTime: number) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`Waiting ${intervalTime}ms to run.`);

            const interval = setInterval(async () => {
                const preCheck: boolean = await exitCallback();
                if (preCheck) {
                    console.log(`Exit criteria met. Exiting..`);
                    clearInterval(interval);
                    return resolve(true);
                }

                await callback();
            }, intervalTime);
        } catch (err) {
            reject(err);
        }
    });
}

export async function runScript(callback: Function) {
    return callback()
        .then(() => {
            process.exit(0);
        })
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}
