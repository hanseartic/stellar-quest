module.exports = (envVarName) => {
    const { Keypair } = require('stellar-sdk');
    if (! process.env[envVarName]) {
        console.log(`Environment variable "${envVarName}" is not set. Store your quest secret in the named environment variable before running.`);
        process.exit(1);
    }
    return Keypair.fromSecret(process.env[envVarName]);
};
