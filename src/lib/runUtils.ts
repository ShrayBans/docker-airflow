export async function singlePromise(callback: Function) {
    return new Promise(async (resolve, reject) => {
        try {
            // Keep going until games are over

            await callback().catch((err) => {
                reject(err);
            });

            return resolve(true);
        } catch (err) {
            reject(err);
        }
    });
}

export async function loopingPromise(exitCallback: Function, callback: Function, intervalTime: number, lockEnabled: boolean = false) {
    let lock: boolean = false;
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`Waiting ${intervalTime}ms to run.`);
            const preCheck: boolean = await exitCallback().catch((err) => {
                reject(err);
            });
            if (preCheck) {
                console.log(`Exit criteria met. Exiting..`);
                return resolve(true);
            }
            await callback().catch((err) => {
                reject(err);
            });;

            const interval = setInterval(async () => {
                if (!lockEnabled || lock === false) {
                    lock = true;
                    const preCheck: boolean = await exitCallback().catch((err) => {
                        reject(err);
                    });;
                    if (preCheck) {
                        console.log(`Exit criteria met. Exiting..`);
                        clearInterval(interval);
                        return resolve(true);
                    }

                    await callback()
                    .then(() => {
                        lock = false
                    })
                    .catch((err) => {
                        reject(err);
                    });;
                }

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
