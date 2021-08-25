module.exports = async (keypairDescription, envVarName) => {
    const { Keypair } = require('stellar-sdk');
    const readVar = require('./readVar');

    return readVar(`Please enter your secret for ${keypairDescription}: `, envVarName)
        //.then(Keypair.fromSecret)
        // for some reason the line above fails with the following
        //   TypeError: Cannot read property 'fromRawEd25519Seed' of undefined
        //       at fromSecret (…/node_modules/stellar-base/lib/keypair.js:246:19)
        //       at processTicksAndRejections (node:internal/process/task_queues:96:5)
        .then(s => Keypair.fromSecret(s))
};
