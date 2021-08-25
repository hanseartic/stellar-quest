module.exports = async (prompt, envVarName) => {
    if (process.env[envVarName]) {
        return Promise.resolve(`${process.env[envVarName]}`);
    } else {
        console.log(`Environment variable '${envVarName}' is not set.`);
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve, reject) => {
            if (readline.terminal) {
                readline.question(
                    `${prompt}`,
                    (answer) => { resolve(answer); }
                );
            } else {
                reject(`No terminal available. Store the value in the environment variable '${envVarName}' before running again.`);
            }
        }).finally(() => readline.close());
    }
};
