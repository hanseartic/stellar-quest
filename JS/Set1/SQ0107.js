const { TransactionBuilder, Asset, Operation, } = require("stellar-sdk");
const { filter } = require('lodash');
const { server, transactionOptions } = require('./../testserver.js');
const { additionalSignerKeypair: channelKeypair } = require('./SQ0104');

const verifyChallenge = async (publicKey) => {
    return await server.loadAccount(publicKey)
        .then(account => account.transactions({order: 'desc', limit: 200}))
        .then(transactions => filter(transactions.records, (transaction) => transaction.source_account !== publicKey))
        .then(channeledTransactions => Promise.all(channeledTransactions.map(transaction => transaction.operations())))
        .then(operations => !!filter(operations.flatMap(op => op.records), (record) => record.type === 'payment').length)
        .catch(err => err);
};

const challenge = async (challengeKeypair, channelKeypair) => {
    console.log('Challenge7: starting');
    const isChallengeVerified = await verifyChallenge(challengeKeypair.publicKey());
    if (isChallengeVerified instanceof Error)
        return isChallengeVerified;

    return await server.loadAccount(challengeKeypair.publicKey())
        .then(account => {
            if (isChallengeVerified === true) {
                console.log('Account already has a channelled payment -> skipping.')
                return account;
            }
            return server.loadAccount(channelKeypair.publicKey())
                .then(channelAccount => {
                    const transaction = new TransactionBuilder(channelAccount, transactionOptions)
                        .addOperation(Operation.payment({
                            source: account.accountId(),
                            destination: channelAccount.accountId(),
                            amount: '5',
                            asset: Asset.native(),
                        }))
                        .setTimeout(0)
                        .build();
                    transaction.sign(channelKeypair);
                    return server.submitTransaction(transaction);
                })
                .then(() => {
                    console.log('Successfully submitted channel-payment');
                    return server.loadAccount(challengeKeypair.publicKey());
                });
        })
        .then(account => {
            console.log('Challenge7: done');
            return account;
        });
};
module.exports = { quest: challenge, verify: verifyChallenge };

if (require.main === module) {
    const { AccountResponse } = require('stellar-sdk');
    const ChallengeKeypair = require('../ChallengeKeypair');
    const keypair = ChallengeKeypair('SQ01_SECRET_KEY');
    challenge(keypair, channelKeypair).then(res => {
        if (res instanceof AccountResponse) {
            console.log(res.account_id);
        } else {
            console.log(res);
        }
    });
}
