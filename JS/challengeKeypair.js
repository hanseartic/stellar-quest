module.exports = async (keypairDescription, envVarName) => {
    const { Keypair } = require('stellar-sdk');
    let secretPromise;
    if (process.env[envVarName]) {
        secretPromise = new Promise((resolve, reject) => { resolve(process.env[envVarName]); });
    } else {
        console.log(`Environment variable "${envVarName}" is not set.`);
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        if (!readline.terminal) {
            console.log('Store the secret in the named environment variable before running.');
            process.exit(1);
        }

        secretPromise = new Promise((resolve, reject) => {
            readline.question(`Please enter your secret for ${keypairDescription}: `,
                (answer) => { resolve(answer); });
        }).finally(() => readline.close());
    }

    return secretPromise.then(secret => Keypair.fromSecret(secret));
};
