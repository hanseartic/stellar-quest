const { Keypair, Operation, TransactionBuilder } = require('stellar-sdk');
const { filter, find } = require('lodash');
const BigNumber = require('bignumber.js');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = async (publicKey) => {
    return await server.loadAccount(publicKey)
        .then(account => account.operations())
        .then(ops => !!find(
            filter(ops.records, (record) => record.type === 'create_account'),
            (createAccountRecord) => new BigNumber(createAccountRecord.starting_balance).eq(1000)))
        .catch(err => err);
};

const challenge = async (challengeKeypair) => {
    console.log('Challenge1: starting');

    return await verifyChallenge(challengeKeypair.publicKey())
        .then(isChallengeVerified => {
            if (isChallengeVerified instanceof Error) {
                console.log('Quest-Account does not exist, yet. Creating it now.');
                const funderKeypair = Keypair.random();
                return server.friendbot(funderKeypair.publicKey())
                    .call().then(() => server.loadAccount(funderKeypair.publicKey()))
                    .then(funderAccount => {
                        console.log(`Created intermediary account ${funderAccount.id}.`);
                        const transaction = new TransactionBuilder(funderAccount, transactionOptions)
                            .addOperation(Operation.createAccount({
                                destination: challengeKeypair.publicKey(),
                                startingBalance: "1000",
                            }))
                            .setTimeout(0)
                            .build();

                        transaction.sign(funderKeypair);
                        return server.submitTransaction(transaction);
                    })
                    .then(() => {
                        console.log('Successfully submitted transaction');
                        return server.loadAccount(challengeKeypair.publicKey());
                    });
            }
            if (isChallengeVerified === true) {
                console.log('Challenge1: Account is already created with correct funding -> skipping');
            } else {
                console.log('Challenge1: Account exists but was not funded with the correct amount. You may want to reset it.');
            }
            return server.loadAccount(challengeKeypair.publicKey());

        })
        .then(account => {
            console.log('Challenge1: done');
            return account;
        });
};
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const challengeKeypair = require('../challengeKeypair');
    challengeKeypair('Quest Keypair', 'SQ01_SECRET_KEY')
        .then(keypair => challenge(keypair))
        .then(res => {
            if (res instanceof AccountResponse) {
                console.log(res.account_id);
            } else {
                console.log(res);
            }
        });
}
