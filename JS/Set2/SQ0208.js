const { Operation, StellarTomlResolver, TransactionBuilder } = require('stellar-sdk');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = (publicKey) => {
    return server.loadAccount(publicKey)
        .then(account => {
            console.log(`Found account ${account.id}`);
            return StellarTomlResolver.resolve(account.home_domain).catch(() => ({}))
        })
        .then(toml => toml['SQ02_EASTER_EGG'] === 'Log into series 2 of Stellar Quest then visit quest.stellar.org/series2. Finally drag and drop your Stellar Quest series 2 badge PNG images onto the screen. Enjoy!'
            ? Promise.resolve()
            : Promise.reject('Did not find expected information.')
        );
}
const challenge = async (challengeKeypair) => {
    return verifyChallenge(challengeKeypair.publicKey())
        .then(() => {
            console.log('Challenge8: Found correct toml entry -> skipping')
        })
        .catch(reason => {
            if (reason instanceof Error) {
                console.log('Challenge8: Could not load account. You may want to go back to challenge 1.')
                return;
            }
            console.log('Challenge8: Running challenge!');
            const homeDomain = 'hanseartic.github.io';
            return server.loadAccount(challengeKeypair.publicKey())
                .then(account => new TransactionBuilder(account, transactionOptions)
                    // according to SEP0001 the quest expects to find the toml-file at
                    // https://${homeDomain}/.well-known/stellar.toml
                    .addOperation(Operation.setOptions({homeDomain: homeDomain}))
                    .setTimeout(0)
                    .build()
                )
                .then(transaction => {
                    transaction.sign(challengeKeypair);
                    return server.submitTransaction(transaction);
                })
        })
        .then(() => {console.log('Challenge8: done!')})
        .then(() => server.loadAccount(challengeKeypair.publicKey()));
}
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    challengeKeypair('Quest Keypair', 'SQ02_SECRET_KEY')
        .then(keypair => challenge(keypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}