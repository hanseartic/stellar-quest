const { Operation, TransactionBuilder } = require('stellar-sdk');
const { filter, find  } = require('lodash');
const { server, transactionOptions } = require('./../testserver.js');

const verifyChallenge = async (publicKey) => {
    return await server.loadAccount(publicKey)
        .then(account => account.operations({order: 'desc', limit: 200}))
        .then(ops => !!find(
                filter(ops.records, (record) => record.type === 'manage_data'),
                (record) => record.name === 'Hello'))
        .catch(err => err);
};

const challenge = async (challengeKeypair) => {
    console.log('Challenge3: starting');
    return verifyChallenge(challengeKeypair.publicKey())
        .then(isChallengeVerified => {
            return isChallengeVerified instanceof Error
                ? isChallengeVerified
                : server.loadAccount(challengeKeypair.publicKey())
                    .then(account => {
                        if (isChallengeVerified === true) {
                            console.log('Challenge3: Already got matching data-record -> skipping');
                            return account;
                        }

                        const transaction = new TransactionBuilder(account, transactionOptions)
                            .addOperation(Operation.manageData({
                                name: 'Hello',
                                value: 'World',
                            }))
                            .setTimeout(0)
                            .build();
                        transaction.sign(challengeKeypair);
                        return server.submitTransaction(transaction)
                            .then(() => {
                                console.log('submitted transaction');
                                return server.loadAccount(challengeKeypair.publicKey());
                            });
                    })
                    .then(account => {
                        console.log('Challenge3: done');
                        return account;
                    });
        });
};
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const ChallengeKeypair = require('../ChallengeKeypair');
    const keypair = ChallengeKeypair('SQ01_SECRET_KEY');
    challenge(keypair).then(res => {
        if (res instanceof AccountResponse) {
            console.log(res.account_id);
        } else {
            console.log(res);
        }
    });
}
